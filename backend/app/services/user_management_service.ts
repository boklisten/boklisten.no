import db from "@adonisjs/lucid/services/db";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";
import { DateTime } from "luxon";

import BadRequestException from "#exceptions/bad_request_exception";
import ForbiddenException from "#exceptions/forbidden_exception";
import Branch from "#models/branch";
import User from "#models/user";
import CustomerItem from "#models/customer_item";
import Invoice from "#models/invoice";
import Order from "#models/order";
import { BranchScope } from "#services/branch_scope";
import type { Viewer } from "#services/branch_scope";
import { countActiveMatches } from "#services/matches/active_matches";
import { SessionRevocationService } from "#services/session_revocation_service";
import type { UserPermission } from "#shared/user-permission";
import { USER_PERMISSION, hasPermissionLevel } from "#shared/user-permission";

/**
 * Where a staff member's home node sits relative to the node asked about: above it (they see
 * this node through a node higher up), on it, or below it (they see only a part of it).
 */
export type EmployeeRelation = "above" | "here" | "below";

interface EmployeeRow {
  userId: string;
  name: string;
  email: string;
  phone: string;
  permission: UserPermission;
  /** The home node (see `shared/user.ts`); the root for admins. */
  employeeBranchId: string;
  relation: EmployeeRelation;
  lastActive: string | null;
}

/**
 * Everyone whose home node is on the path through the node: homed above it, on it, or below it.
 * That is the audit answer to "who can see this node's data, and how much of it": staff above
 * see all of it, staff on it see all of it and are managed here, staff below see their own part.
 */
async function getEmployees(branchId: string): Promise<EmployeeRow[]> {
  const [above, subtree] = await Promise.all([
    BranchScope.ancestorIds(branchId),
    BranchScope.subtreeIds(branchId),
  ]);
  const aboveIds = new Set(above);
  const employees = await User.employees([...above, ...subtree]);
  return employees.map((employee) => ({
    userId: employee.id,
    name: employee.name ?? "",
    email: employee.email,
    phone: employee.phone ?? "",
    permission: employee.permission,
    employeeBranchId: employee.employeeBranchId,
    relation: aboveIds.has(employee.employeeBranchId)
      ? "above"
      : employee.employeeBranchId === branchId
        ? "here"
        : "below",
    lastActive: employee.lastActiveAt?.toISO() ?? null,
  }));
}

/**
 * Sets the level and, for employees and managers, the home node. Only those two levels hold a
 * node of their own: an admin works from the root and a customer has no workplace, so either
 * level snaps the node back to the root whatever was given. A user given no node keeps the one
 * they have. A change of level ends the user's sessions; a change of node alone does not.
 *
 * A manager (Filialsjef) may hand out every level below admin and may not touch an admin; an
 * admin may do anything.
 */
async function setPermission(
  actor: Viewer,
  userIds: string[],
  permission: UserPermission,
  employeeBranchId?: string,
) {
  const users = await User.findMany(userIds);
  for (const userId of userIds) {
    const user = users.find((candidate) => candidate.id === userId);
    // Someone outside the actor's scope is as unknown to them as a made-up id.
    if (user === undefined || !(await personInScope(actor, user))) {
      throw new BadRequestException(`Fant ingen bruker for kunde ${userId}`);
    }
  }
  assertMayGrant(actor.permission, users, permission);
  const homeNode = await homeNodeFor(actor, permission, employeeBranchId, users);
  await User.query()
    .whereIn("id", userIds)
    .update({ permission, ...homeNode, updatedAt: DateTime.now() });
  // The new level applies from their next login, not from whenever their cookie would have expired.
  const demotedOrPromoted = users.filter((user) => user.permission !== permission);
  await Promise.all(demotedOrPromoted.map((user) => SessionRevocationService.revokeAll(user.id)));
  return { updated: userIds.length };
}

function assertMayGrant(
  actorPermission: UserPermission,
  users: User[],
  permission: UserPermission,
) {
  if (hasPermissionLevel(actorPermission, USER_PERMISSION.ADMIN)) {
    return;
  }
  if (permission === USER_PERMISSION.ADMIN) {
    throw new ForbiddenException("Bare administratorer kan gi noen tilgangsnivået Administrator");
  }
  const admin = users.find((user) => user.permission === USER_PERMISSION.ADMIN);
  if (admin !== undefined) {
    throw new ForbiddenException(
      `${admin.name} er administrator, og bare administratorer kan endre tilgangsnivået deres`,
    );
  }
}

const LEVELS_WITH_A_HOME_NODE: ReadonlySet<UserPermission> = new Set([
  USER_PERMISSION.EMPLOYEE,
  USER_PERMISSION.MANAGER,
]);

/**
 * Staff are in the actor's scope when homed in their subtree, customers when `customerInScope`
 * says so; an admin, homed at the root, reaches everyone.
 */
async function personInScope(actor: Viewer, user: User): Promise<boolean> {
  return user.permission === USER_PERMISSION.CUSTOMER
    ? BranchScope.customerInScope(actor, user.id)
    : BranchScope.placeInScope(actor, user.employeeBranchId);
}

/**
 * The node is one the actor may work on themselves: a manager homes staff inside their own
 * subtree. A user given no node keeps the one they have, so that one is checked too: a customer
 * is homed at the root, and promoting them "in place" would otherwise make head office.
 */
async function homeNodeFor(
  actor: Viewer,
  permission: UserPermission,
  employeeBranchId: string | undefined,
  users: User[],
): Promise<{ employeeBranchId?: string }> {
  if (!LEVELS_WITH_A_HOME_NODE.has(permission)) {
    return { employeeBranchId: (await Branch.root()).id };
  }
  if (employeeBranchId === undefined) {
    for (const user of users) {
      await BranchScope.assertSelectableTarget(actor, user.employeeBranchId);
    }
    return {};
  }
  const branch = await Branch.find(employeeBranchId);
  if (branch === null) {
    throw new BadRequestException("Fant ingen filial å knytte den ansatte til");
  }
  await BranchScope.assertSelectableTarget(actor, branch.id);
  return { employeeBranchId: branch.id };
}

function assertIsCustomer(user: User, action: string) {
  if (user.permission !== USER_PERMISSION.CUSTOMER) {
    throw new BadRequestException(
      `Brukeren er registrert som ${user.permission} og kan ikke ${action}. Endre tilgangsnivået til kunde først.`,
    );
  }
}

/**
 * Deletes a customer who has no active book, invoice or undischarged match obligation. Orders the
 * stand still owes books on go with the customer, since an open order of a customer who no longer
 * exists can never be fulfilled; a paid one blocks the deletion until it is refunded or cancelled.
 * The remaining foreign keys cascade (signatures, login tokens, settled match participations) or
 * set the reference to null: settled orders, customer items and invoices are kept for the book
 * history and the accounts (invoices keep their copy of the customer), as are handovers, messages
 * and sendouts.
 */
async function deleteUser(userId: string) {
  const user = await User.find(userId);
  if (!user) {
    throw new BadRequestException("Fant ikke kunden");
  }
  assertIsCustomer(user, "slettes");

  const [activeCustomerItems, activeInvoices, activeMatches] = await Promise.all([
    CustomerItem.hasActive(userId),
    Invoice.hasActive(userId),
    countActiveMatches([userId]),
  ]);
  if (activeCustomerItems) {
    throw new BadRequestException("Kunden har aktive bøker og kan ikke slettes");
  }
  if (activeInvoices) {
    throw new BadRequestException("Kunden har aktive fakturaer og kan ikke slettes");
  }
  if ((activeMatches.get(userId) ?? 0) > 0) {
    throw new BadRequestException("Kunden har aktive overleveringer og kan ikke slettes");
  }

  await db.transaction(async (trx) => {
    const { paid, unpaid } = await Order.openOrdersOf(userId, trx);
    if (paid.length > 0) {
      throw new BadRequestException(
        "Kunden har betalte bestillinger som ikke er levert og kan ikke slettes. Refunder eller kanseller dem først.",
      );
    }
    if (unpaid.length > 0) {
      await trx.from("orders").whereIn("id", unpaid).delete();
    }
    await user.useTransaction(trx).delete();
  });
}

/** Moves every reference from the source user onto the target user, then deletes the source user. */
async function mergeUsers(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    throw new BadRequestException("Kan ikke slå sammen en kunde med seg selv");
  }
  const [fromUser, toUser] = await Promise.all([User.find(fromUserId), User.find(toUserId)]);
  if (!fromUser || !toUser) {
    throw new BadRequestException("Fant ikke begge kundene");
  }
  assertIsCustomer(fromUser, "slås sammen");
  assertIsCustomer(toUser, "slås sammen");

  await db.transaction(async (trx) => {
    const repoint = async (table: string, column: string) =>
      trx
        .from(table)
        .where(column, fromUserId)
        .update({ [column]: toUserId });
    await repoint("signatures", "customer_id");
    await repoint("customer_items", "customer_id");
    await repoint("orders", "customer_id");
    await repoint("invoices", "customer_id");
    await repoint("book_handovers", "from_user_id");
    await repoint("book_handovers", "to_user_id");
    await mergeMatchParticipants(trx, fromUserId, toUserId);
    // The source's login tokens, signatures and remaining participations go with the row.
    await fromUser.useTransaction(trx).delete();
  });
}

/**
 * (matchId, userId) is unique, so in a match both users take part in, the source's
 * obligations move onto the target's participant row and the source's row is deleted.
 */
async function mergeMatchParticipants(
  trx: TransactionClientContract,
  fromUserId: string,
  toUserId: string,
) {
  const shared: { sourceId: number; targetId: number }[] = await trx
    .from("match_participants as source")
    .join("match_participants as target", "target.match_id", "source.match_id")
    .where("source.user_id", fromUserId)
    .where("target.user_id", toUserId)
    .select("source.id as sourceId", "target.id as targetId");
  for (const { sourceId, targetId } of shared) {
    // An obligation between the two becomes one with yourself, which a check constraint forbids.
    // Deleting it sets the handovers' discharge pointers to null, keeping the history.
    await trx
      .from("match_obligations")
      .where((query) =>
        query.where("sender_participant_id", sourceId).where("receiver_participant_id", targetId),
      )
      .orWhere((query) =>
        query.where("sender_participant_id", targetId).where("receiver_participant_id", sourceId),
      )
      .delete();
    await trx
      .from("match_obligations")
      .where("sender_participant_id", sourceId)
      .update({ sender_participant_id: targetId });
    await trx
      .from("match_obligations")
      .where("receiver_participant_id", sourceId)
      .update({ receiver_participant_id: targetId });
    await trx.from("match_participants").where("id", sourceId).delete();
  }
  await trx.from("match_participants").where("user_id", fromUserId).update({ user_id: toUserId });
}

export const UserManagementService = {
  getEmployees,
  setPermission,
  deleteUser,
  mergeUsers,
};
