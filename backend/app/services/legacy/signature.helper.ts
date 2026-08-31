import Signature from "#models/signature";
import { CustomerItemActive } from "#services/legacy/collections/customer-item/helpers/customer-item-active";
import { OrderActive } from "#services/legacy/collections/order/helpers/order-active/order-active";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { CustomerItem } from "#shared/customer-item/customer-item";
import { UserDetail } from "#shared/user-detail";

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
    if (!taskIsSet) return userDetail;
    return await StorageService.UserDetails.update(userDetail.id, {
      "tasks.signAgreement": false,
    });
  }

  if (taskIsSet) return userDetail;

  if (
    (await hasOpenSignatureRequiringOrder(userDetail.id)) ||
    (await possessesSignatureRequiringItem(userDetail.id))
  ) {
    return await StorageService.UserDetails.update(userDetail.id, {
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

export async function verifyCustomerSignature(customerId: string): Promise<string | null> {
  const userDetail = await StorageService.UserDetails.getOrNull(customerId);
  if (!userDetail) {
    return "Kunden mangler gyldig signatur, og kan derfor ikke få utdelt bøker. Be kunden signere først.";
  }
  const reconciled = await reconcileSignatureTask(userDetail);
  if (reconciled.tasks?.signAgreement) {
    return "Kunden mangler gyldig signatur, og kan derfor ikke få utdelt bøker. Be kunden signere først.";
  }
  return null;
}
