import db from "@adonisjs/lucid/services/db";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";
import { DateTime } from "luxon";

import BadRequestException from "#exceptions/bad_request_exception";
import User from "#models/user";
import CustomerItem from "#models/customer_item";
import Invoice from "#models/invoice";
import Order from "#models/order";
import { countActiveMatches } from "#services/matches/active_matches";
import { SessionRevocationService } from "#services/session_revocation_service";
import type { UserPermission } from "#shared/user-permission";
import { USER_PERMISSION } from "#shared/user-permission";

interface EmployeeRow {
  detailsId: string;
  name: string;
  email: string;
  phone: string;
  permission: UserPermission;
  lastActive: string | null;
}

async function getEmployees(): Promise<EmployeeRow[]> {
  const employees = await User.employees();
  return employees.map((employee) => ({
    detailsId: employee.id,
    name: employee.name,
    email: employee.email,
    phone: employee.phone ?? "",
    permission: employee.permission,
    lastActive: employee.lastActiveAt?.toISO() ?? null,
  }));
}

async function setPermission(detailsIds: string[], permission: UserPermission) {
  const users = await User.findMany(detailsIds);
  const missing = detailsIds.find((detailsId) => !users.some((user) => user.id === detailsId));
  if (missing !== undefined) {
    throw new BadRequestException(`Fant ingen bruker for kunde ${missing}`);
  }
  await User.query().whereIn("id", detailsIds).update({ permission, updatedAt: DateTime.now() });
  // The new level applies from their next login, not from whenever their cookie would have expired.
  await Promise.all(detailsIds.map((detailsId) => SessionRevocationService.revokeAll(detailsId)));
  return { updated: detailsIds.length };
}

function assertIsCustomer(user: User, action: string) {
  if (user.permission !== USER_PERMISSION.CUSTOMER) {
    throw new BadRequestException(
      `Brukeren er registrert som ${user.permission} og kan ikke ${action}. Endre tilgangsnivået til kunde først.`,
    );
  }
}

/**
 * Deletes a customer who has nothing open: no active order, book, invoice or undischarged match
 * obligation. The foreign keys cascade (signatures, login tokens, settled match participations) or
 * set the reference to null: orders, customer items and invoices are kept for the book history and
 * the accounts (invoices keep their copy of the customer), as are handovers, messages and sendouts.
 */
async function deleteUser(detailsId: string) {
  const user = await User.find(detailsId);
  if (!user) {
    throw new BadRequestException("Fant ikke kunden");
  }
  assertIsCustomer(user, "slettes");

  const [activeOrders, activeCustomerItems, activeInvoices, activeMatches] = await Promise.all([
    Order.hasOpenLines(detailsId),
    CustomerItem.hasActive(detailsId),
    Invoice.hasActive(detailsId),
    countActiveMatches([detailsId]),
  ]);
  if (activeOrders) {
    throw new BadRequestException("Kunden har aktive bestillinger og kan ikke slettes");
  }
  if (activeCustomerItems) {
    throw new BadRequestException("Kunden har aktive bøker og kan ikke slettes");
  }
  if (activeInvoices) {
    throw new BadRequestException("Kunden har aktive fakturaer og kan ikke slettes");
  }
  if ((activeMatches.get(detailsId) ?? 0) > 0) {
    throw new BadRequestException("Kunden har aktive overleveringer og kan ikke slettes");
  }

  await user.delete();
}

/** Moves every reference from the source user onto the target user, then deletes the source user. */
async function mergeUsers(fromDetailsId: string, toDetailsId: string) {
  if (fromDetailsId === toDetailsId) {
    throw new BadRequestException("Kan ikke slå sammen en kunde med seg selv");
  }
  const [fromUser, toUser] = await Promise.all([User.find(fromDetailsId), User.find(toDetailsId)]);
  if (!fromUser || !toUser) {
    throw new BadRequestException("Fant ikke begge kundene");
  }
  assertIsCustomer(fromUser, "slås sammen");
  assertIsCustomer(toUser, "slås sammen");

  await db.transaction(async (trx) => {
    const repoint = async (table: string, column: string) =>
      trx
        .from(table)
        .where(column, fromDetailsId)
        .update({ [column]: toDetailsId });
    await repoint("signatures", "customer_details_id");
    await repoint("customer_items", "customer_id");
    await repoint("orders", "customer_id");
    await repoint("invoices", "customer_id");
    await repoint("book_handovers", "from_user_detail_id");
    await repoint("book_handovers", "to_user_detail_id");
    await mergeMatchParticipants(trx, fromDetailsId, toDetailsId);
    // The source's login tokens, signatures and remaining participations go with the row.
    await fromUser.useTransaction(trx).delete();
  });
}

/**
 * (matchId, userDetailId) is unique, so in a match both users take part in, the source's
 * obligations move onto the target's participant row and the source's row is deleted.
 */
async function mergeMatchParticipants(
  trx: TransactionClientContract,
  fromDetailsId: string,
  toDetailsId: string,
) {
  const shared: { sourceId: number; targetId: number }[] = await trx
    .from("match_participants as source")
    .join("match_participants as target", "target.match_id", "source.match_id")
    .where("source.user_detail_id", fromDetailsId)
    .where("target.user_detail_id", toDetailsId)
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
  await trx
    .from("match_participants")
    .where("user_detail_id", fromDetailsId)
    .update({ user_detail_id: toDetailsId });
}

export const UserManagementService = {
  getEmployees,
  setPermission,
  deleteUser,
  mergeUsers,
};
