import db from "@adonisjs/lucid/services/db";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";
import { DateTime } from "luxon";

import BadRequestException from "#exceptions/bad_request_exception";
import Branch from "#models/branch";
import User from "#models/user";
import CustomerItem from "#models/customer_item";
import Invoice from "#models/invoice";
import Order from "#models/order";
import { countActiveMatches } from "#services/matches/active_matches";
import { SessionRevocationService } from "#services/session_revocation_service";
import type { UserPermission } from "#shared/user-permission";
import { USER_PERMISSION } from "#shared/user-permission";

interface EmployeeRow {
  userId: string;
  name: string;
  email: string;
  phone: string;
  permission: UserPermission;
  /** The home node (see `shared/user.ts`); the root for admins. */
  employeeBranchId: string;
  lastActive: string | null;
}

async function getEmployees(): Promise<EmployeeRow[]> {
  const employees = await User.employees();
  return employees.map((employee) => ({
    userId: employee.id,
    name: employee.name ?? "",
    email: employee.email,
    phone: employee.phone ?? "",
    permission: employee.permission,
    employeeBranchId: employee.employeeBranchId,
    lastActive: employee.lastActiveAt?.toISO() ?? null,
  }));
}

/**
 * Sets the level and, for employees, the home node. Only employees hold a node of their own:
 * an admin works from the root and a customer has no workplace, so either level snaps the node
 * back to the root whatever was given. An employee given no node keeps the one they have.
 */
async function setPermission(
  userIds: string[],
  permission: UserPermission,
  employeeBranchId?: string,
) {
  const users = await User.findMany(userIds);
  const missing = userIds.find((userId) => !users.some((user) => user.id === userId));
  if (missing !== undefined) {
    throw new BadRequestException(`Fant ingen bruker for kunde ${missing}`);
  }
  const homeNode = await homeNodeFor(permission, employeeBranchId);
  await User.query()
    .whereIn("id", userIds)
    .update({ permission, ...homeNode, updatedAt: DateTime.now() });
  // The new level applies from their next login, not from whenever their cookie would have expired.
  await Promise.all(userIds.map((userId) => SessionRevocationService.revokeAll(userId)));
  return { updated: userIds.length };
}

async function homeNodeFor(
  permission: UserPermission,
  employeeBranchId: string | undefined,
): Promise<{ employeeBranchId?: string }> {
  if (permission !== USER_PERMISSION.EMPLOYEE) {
    return { employeeBranchId: (await Branch.root()).id };
  }
  if (employeeBranchId === undefined) {
    return {};
  }
  const branch = await Branch.find(employeeBranchId);
  if (branch === null) {
    throw new BadRequestException("Fant ingen filial å knytte den ansatte til");
  }
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
