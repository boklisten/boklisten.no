import BadRequestException from "#exceptions/bad_request_exception";
import BookHandover from "#models/book_handover";
import EmailVerification from "#models/email_verification";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import PasswordReset from "#models/password_reset";
import Signature from "#models/signature";
import { CustomerHaveActiveCustomerItems } from "#services/legacy/collections/customer-item/helpers/customer-have-active-customer-items";
import { CustomerInvoiceActive } from "#services/legacy/collections/invoice/helpers/customer-invoice-active";
import { OrderActive } from "#services/legacy/collections/order/helpers/order-active/order-active";
import { StorageService } from "#services/storage_service";
import { UserService } from "#services/user_service";
import { USER_PERMISSION, UserPermission } from "#shared/user-permission";

export interface EmployeeRow {
  detailsId: string;
  name: string;
  email: string;
  phone: string;
  permission: UserPermission;
  lastActive: string | null;
}

async function getEmployees(): Promise<EmployeeRow[]> {
  const rows = await StorageService.Users.aggregate<
    Omit<EmployeeRow, "lastActive"> & { lastActive?: Date }
  >([
    { $match: { permission: { $ne: USER_PERMISSION.CUSTOMER } } },
    {
      $lookup: {
        from: "userdetails",
        localField: "userDetail",
        foreignField: "_id",
        as: "details",
      },
    },
    { $unwind: { path: "$details", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        detailsId: "$userDetail",
        permission: 1,
        name: { $ifNull: ["$details.name", ""] },
        email: { $ifNull: ["$details.email", ""] },
        phone: { $ifNull: ["$details.phone", ""] },
        lastActive: "$login.lastTokenIssuedAt",
      },
    },
    { $sort: { name: 1 } },
  ]);

  return rows.map((row) => ({
    detailsId: String(row.detailsId),
    name: row.name,
    email: row.email,
    phone: row.phone,
    permission: row.permission,
    lastActive: row.lastActive ? new Date(row.lastActive).toISOString() : null,
  }));
}

async function setPermission(detailsIds: string[], permission: UserPermission) {
  let updated = 0;
  for (const detailsId of detailsIds) {
    const user = await UserService.getByUserDetailsId(detailsId);
    if (!user) {
      throw new BadRequestException(`Fant ingen bruker for kunde ${detailsId}`);
    }
    await StorageService.Users.update(user.id, { permission });
    updated++;
  }
  return { updated };
}

async function assertIsCustomer(detailsId: string, action: string) {
  const user = await UserService.getByUserDetailsId(detailsId);
  if (user && user.permission !== USER_PERMISSION.CUSTOMER) {
    throw new BadRequestException(
      `Brukeren er registrert som ${user.permission} og kan ikke ${action}. Endre tilgangsnivået til kunde først.`,
    );
  }
  return user;
}

async function deleteUser(detailsId: string) {
  const userDetail = await StorageService.UserDetails.getOrNull(detailsId);
  if (!userDetail) {
    throw new BadRequestException("Fant ikke kunden");
  }
  const user = await assertIsCustomer(detailsId, "slettes");

  const [activeOrders, activeCustomerItems, activeInvoices] = await Promise.all([
    new OrderActive().haveActiveOrders(detailsId),
    new CustomerHaveActiveCustomerItems().haveActiveCustomerItems(detailsId),
    new CustomerInvoiceActive().haveActiveInvoices(detailsId),
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

  await removeAuthArtifacts(detailsId);
  if (user) await StorageService.Users.remove(user.id);
  await StorageService.UserDetails.remove(detailsId);
}

async function removeAuthArtifacts(detailsId: string) {
  await Promise.all([
    EmailVerification.query().where("userDetailId", detailsId).delete(),
    PasswordReset.query().where("userDetailId", detailsId).delete(),
  ]);
}

const union = (first: string[] | undefined, second: string[] | undefined) => [
  ...new Set([...(first ?? []), ...(second ?? [])]),
];

/**
 * Moves every reference from the source user onto the target user, then
 * deletes the source login and user detail. References are re-pointed before
 * anything is deleted, so a mid-way failure leaves no dangling references.
 */
async function mergeUsers(fromDetailsId: string, toDetailsId: string) {
  if (fromDetailsId === toDetailsId) {
    throw new BadRequestException("Kan ikke slå sammen en kunde med seg selv");
  }
  const [fromDetails, toDetails] = await Promise.all([
    StorageService.UserDetails.getOrNull(fromDetailsId),
    StorageService.UserDetails.getOrNull(toDetailsId),
  ]);
  if (!fromDetails || !toDetails) {
    throw new BadRequestException("Fant ikke begge kundene");
  }
  const fromUser = await assertIsCustomer(fromDetailsId, "slås sammen");
  await assertIsCustomer(toDetailsId, "slås sammen");

  await StorageService.UserDetails.update(toDetailsId, {
    orders: union(toDetails.orders, fromDetails.orders),
    customerItems: union(toDetails.customerItems, fromDetails.customerItems),
  });

  await Promise.all([
    Signature.reassignCustomer(fromDetailsId, toDetailsId),
    StorageService.CustomerItems.updateMany({ customer: fromDetailsId }, { customer: toDetailsId }),
    StorageService.Orders.updateMany({ customer: fromDetailsId }, { customer: toDetailsId }),
    StorageService.Payments.updateMany({ customer: fromDetailsId }, { customer: toDetailsId }),
    StorageService.Invoices.updateMany(
      { "customerInfo.userDetail": fromDetailsId },
      { "customerInfo.userDetail": toDetailsId },
    ),
    StorageService.Messages.updateMany({ customerId: fromDetailsId }, { customerId: toDetailsId }),
    BookHandover.query()
      .where("fromUserDetailId", fromDetailsId)
      .update({ fromUserDetailId: toDetailsId }),
    BookHandover.query()
      .where("toUserDetailId", fromDetailsId)
      .update({ toUserDetailId: toDetailsId }),
  ]);

  await mergeMatchParticipants(fromDetailsId, toDetailsId);
  await removeAuthArtifacts(fromDetailsId);

  if (fromUser) await StorageService.Users.remove(fromUser.id);
  await StorageService.UserDetails.remove(fromDetailsId);
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
