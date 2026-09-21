import BadRequestException from "#exceptions/bad_request_exception";
import BookHandover from "#models/book_handover";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import Signature from "#models/signature";
import User from "#models/user";
import { CustomerHaveActiveCustomerItems } from "#services/customer_items/customer_have_active_customer_items";
import { CustomerInvoiceActive } from "#services/invoices/customer_invoice_active";
import { countActiveMatches } from "#services/matches/active_matches";
import { OrderActive } from "#services/orders/order_active";
import { StorageService } from "#services/storage_service";
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
    lastActive: employee.lastTokenIssuedAt?.toISO() ?? null,
  }));
}

async function setPermission(detailsIds: string[], permission: UserPermission) {
  const users = await User.findMany(detailsIds);
  const missing = detailsIds.find((detailsId) => !users.some((user) => user.id === detailsId));
  if (missing !== undefined) {
    throw new BadRequestException(`Fant ingen bruker for kunde ${missing}`);
  }
  await User.query().whereIn("id", detailsIds).update({ permission });
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
 * obligation. Their orders, customer items and invoices in Mongo are kept for the book history; in
 * Postgres the foreign keys cascade (signatures, login tokens, settled match participations) or
 * set the reference to null (handovers, messages, sendouts).
 */
async function deleteUser(detailsId: string) {
  const user = await User.find(detailsId);
  if (!user) {
    throw new BadRequestException("Fant ikke kunden");
  }
  assertIsCustomer(user, "slettes");

  const [activeOrders, activeCustomerItems, activeInvoices, activeMatches] = await Promise.all([
    new OrderActive().haveActiveOrders(detailsId),
    new CustomerHaveActiveCustomerItems().haveActiveCustomerItems(detailsId),
    new CustomerInvoiceActive().haveActiveInvoices(detailsId),
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

/**
 * Moves every reference from the source user onto the target user, then
 * deletes the source user. References are re-pointed before
 * anything is deleted, so a mid-way failure leaves no dangling references.
 */
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

  await Promise.all([
    Signature.reassignCustomer(fromDetailsId, toDetailsId),
    StorageService.CustomerItems.updateMany({ customer: fromDetailsId }, { customer: toDetailsId }),
    StorageService.Orders.updateMany({ customer: fromDetailsId }, { customer: toDetailsId }),
    StorageService.Payments.updateMany({ customer: fromDetailsId }, { customer: toDetailsId }),
    StorageService.Invoices.updateMany(
      { "customerInfo.userDetail": fromDetailsId },
      { "customerInfo.userDetail": toDetailsId },
    ),
    BookHandover.query()
      .where("fromUserDetailId", fromDetailsId)
      .update({ fromUserDetailId: toDetailsId }),
    BookHandover.query()
      .where("toUserDetailId", fromDetailsId)
      .update({ toUserDetailId: toDetailsId }),
  ]);

  await mergeMatchParticipants(fromDetailsId, toDetailsId);

  // The source's login tokens, signatures and remaining participations go with the row.
  await fromUser.delete();
}

/**
 * (matchId, userDetailId) is unique, so when both users participate in the
 * same match the source's obligations are re-pointed onto the target's
 * participant row and the source's row is deleted.
 */
async function mergeMatchParticipants(fromDetailsId: string, toDetailsId: string) {
  const [fromParticipants, toParticipants] = await Promise.all([
    MatchParticipant.query().where("userDetailId", fromDetailsId),
    MatchParticipant.query().where("userDetailId", toDetailsId),
  ]);
  const targetByMatch = new Map(
    toParticipants.map((participant) => [participant.matchId, participant]),
  );
  for (const participant of fromParticipants) {
    const existingTarget = targetByMatch.get(participant.matchId);
    if (!existingTarget) {
      participant.userDetailId = toDetailsId;
      await participant.save();
      continue;
    }
    // An obligation between the two merging users becomes an obligation with
    // yourself, which is both meaningless and forbidden by a check constraint.
    // Deleting it SET NULLs any handover discharge pointers, keeping history.
    await MatchObligation.query()
      .where((query) =>
        query
          .where("senderParticipantId", participant.id)
          .andWhere("receiverParticipantId", existingTarget.id),
      )
      .orWhere((query) =>
        query
          .where("senderParticipantId", existingTarget.id)
          .andWhere("receiverParticipantId", participant.id),
      )
      .delete();
    await MatchObligation.query()
      .where("senderParticipantId", participant.id)
      .update({ senderParticipantId: existingTarget.id });
    await MatchObligation.query()
      .where("receiverParticipantId", participant.id)
      .update({ receiverParticipantId: existingTarget.id });
    await participant.delete();
  }
}

export const UserManagementService = {
  getEmployees,
  setPermission,
  deleteUser,
  mergeUsers,
};
