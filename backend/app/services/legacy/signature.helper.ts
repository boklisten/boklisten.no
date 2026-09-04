import Signature from "#models/signature";
import { CustomerItemActive } from "#services/legacy/collections/customer-item/helpers/customer-item-active";
import { OrderActive } from "#services/legacy/collections/order/helpers/order-active/order-active";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { UserDetail } from "#shared/user-detail";

const signatureRequiringOrderItemTypes = new Set(["rent", "partly-payment"]);

export async function userHasValidSignature(userDetail: UserDetail): Promise<boolean> {
  return (await Signature.validForCustomer(userDetail)) != null;
}

/**
 * The single maintainer of the `tasks.signAgreement` flag, which is the one variable every
 * signature-requirement consumer reads. A valid signature clears the task; lacking one, the task is
 * set when the customer has an open order for books (anything but a purchase) or holds any
 * active book. A task that was requested elsewhere (provisioning, signature link) is a demand that
 * stays until signed.
 */
export async function reconcileSignatureTask(userDetail: UserDetail): Promise<UserDetail> {
  const taskIsSet = userDetail.tasks?.signAgreement === true;

  if (await userHasValidSignature(userDetail)) {
    if (!taskIsSet) {
      return userDetail;
    }
    return StorageService.UserDetails.update(userDetail.id, {
      "tasks.signAgreement": false,
    });
  }

  if (taskIsSet) {
    return userDetail;
  }

  if (
    (await hasOpenSignatureRequiringOrder(userDetail.id)) ||
    (await possessesSignatureRequiringItem(userDetail.id))
  ) {
    return StorageService.UserDetails.update(userDetail.id, {
      "tasks.signAgreement": true,
    });
  }

  return userDetail;
}

async function hasOpenSignatureRequiringOrder(customerId: string): Promise<boolean> {
  const orderActive = new OrderActive();
  const activeOrders = await orderActive.getActiveOrders(customerId);
  return activeOrders.some((order) =>
    order.orderItems.some(
      (orderItem) =>
        signatureRequiringOrderItemTypes.has(orderItem.type) &&
        orderActive.isOrderItemActive(orderItem),
    ),
  );
}

async function possessesSignatureRequiringItem(customerId: string): Promise<boolean> {
  const databaseQuery = new SEDbQueryBuilder().getDbQuery({ customer: customerId }, [
    { fieldName: "customer", type: "object-id" },
  ]);

  let customerItems: CustomerItem[];
  try {
    customerItems = await StorageService.CustomerItems.getByQuery(databaseQuery);
  } catch (error) {
    if (error instanceof BlError && error.getCode() === 702) {
      return false;
    }
    throw error;
  }

  const customerItemActive = new CustomerItemActive();
  return customerItems.some(
    (customerItem) => customerItem.handout && customerItemActive.isActive(customerItem),
  );
}

export const SIGNATURE_EXCEPTION_REASONS = {
  neverSigned: "Aldri signert",
  expired: "Signaturen er utløpt",
  outgrownGuardian: "Signert av foresatt, kunden har fylt 18",
  underageWithoutGuardian: "Signert uten foresatt, kunden er under 18",
} as const;

export type SignatureExceptionReason =
  (typeof SIGNATURE_EXCEPTION_REASONS)[keyof typeof SIGNATURE_EXCEPTION_REASONS];

/**
 * Why handing books out to this customer is an exception, or null when the customer either has a
 * valid signature or needs none. The wording is what the exception report to the administrator
 * carries, so it names the state of the newest signature rather than what the customer must do.
 */
export async function findSignatureException(
  userDetail: UserDetail,
): Promise<SignatureExceptionReason | null> {
  const reconciled = await reconcileSignatureTask(userDetail);
  if (!reconciled.tasks?.signAgreement) {
    return null;
  }
  const newestSignature = await Signature.newestForCustomer(userDetail.id);
  if (!newestSignature) {
    return SIGNATURE_EXCEPTION_REASONS.neverSigned;
  }
  if (newestSignature.isExpired()) {
    return SIGNATURE_EXCEPTION_REASONS.expired;
  }
  if (newestSignature.isOutgrownGuardianFor(userDetail)) {
    return SIGNATURE_EXCEPTION_REASONS.outgrownGuardian;
  }
  return SIGNATURE_EXCEPTION_REASONS.underageWithoutGuardian;
}
