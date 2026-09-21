import BadRequestException from "#exceptions/bad_request_exception";
import Signature from "#models/signature";
import type User from "#models/user";
import { CustomerItemActive } from "#services/customer_items/customer_item_active";
import { OrderActive } from "#services/orders/order_active";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { SIGNATURE_REQUIRING_CART_ITEM_TYPES } from "#shared/cart_item";
import type { CustomerItem } from "#shared/customer-item/customer-item";

const signatureRequiringOrderItemTypes = new Set<string>(SIGNATURE_REQUIRING_CART_ITEM_TYPES);

const SIGNATURE_REQUIRED_TO_ORDER_MESSAGE = "Du må signere låneavtalen før du kan bestille bøker.";

export async function userHasValidSignature(
  user: Parameters<typeof Signature.validForCustomer>[0],
): Promise<boolean> {
  return (await Signature.validForCustomer(user)) != null;
}

/**
 * The customer checkout's gate: a customer may not create an order for books to borrow without a
 * valid signature. The signing step in the checkout flow normally clears this before the order is
 * created, so failing here means the step was skipped (a stale tab, a direct request).
 */
export async function assertSignedForCheckout(
  user: User,
  cartItems: { type: string }[],
): Promise<void> {
  if (!cartItems.some((cartItem) => signatureRequiringOrderItemTypes.has(cartItem.type))) {
    return;
  }
  if (await userHasValidSignature(user)) {
    return;
  }
  throw new BadRequestException(SIGNATURE_REQUIRED_TO_ORDER_MESSAGE);
}

/**
 * The single maintainer of the `taskSignAgreement` flag, which is the one variable every
 * signature-requirement consumer reads. A valid signature clears the task; lacking one, the task is
 * set when the customer has an open order for books (anything but a purchase) or holds any
 * active book. A task that was requested elsewhere (provisioning, signature link) is a demand that
 * stays until signed. Saves the user when the flag changes and returns them either way.
 */
export async function reconcileSignatureTask(user: User): Promise<User> {
  const taskIsSet = user.taskSignAgreement;

  if (await userHasValidSignature(user)) {
    if (taskIsSet) {
      user.taskSignAgreement = false;
      await user.save();
    }
    return user;
  }

  if (taskIsSet) {
    return user;
  }

  if (
    (await hasOpenSignatureRequiringOrder(user.id)) ||
    (await possessesSignatureRequiringItem(user.id))
  ) {
    user.taskSignAgreement = true;
    await user.save();
  }

  return user;
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
  const databaseQuery = new SEDbQuery();
  databaseQuery.objectIdFilters = [{ fieldName: "customer", value: customerId }];

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

const SIGNATURE_EXCEPTION_REASONS = {
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
export async function findSignatureException(user: User): Promise<SignatureExceptionReason | null> {
  const reconciled = await reconcileSignatureTask(user);
  if (!reconciled.taskSignAgreement) {
    return null;
  }
  const newestSignature = await Signature.newestForCustomer(user.id);
  if (!newestSignature) {
    return SIGNATURE_EXCEPTION_REASONS.neverSigned;
  }
  if (newestSignature.isExpired()) {
    return SIGNATURE_EXCEPTION_REASONS.expired;
  }
  if (newestSignature.isOutgrownGuardianFor(user)) {
    return SIGNATURE_EXCEPTION_REASONS.outgrownGuardian;
  }
  return SIGNATURE_EXCEPTION_REASONS.underageWithoutGuardian;
}
