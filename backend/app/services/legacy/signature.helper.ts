import { Signature } from "#models/mongoose/signature.schema";
import { CustomerItemActive } from "#services/legacy/collections/customer-item/helpers/customer-item-active";
import { OrderActive } from "#services/legacy/collections/order/helpers/order-active/order-active";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { CustomerItem } from "#shared/customer-item/customer-item";
import { SIGNATURE_NUM_MONTHS_VALID, SignatureMetadata } from "#shared/serialized-signature";
import { UserDetail } from "#shared/user-detail";

const signatureRequiringItemTypes = new Set(["rent", "loan"]);

export async function getValidUserSignature(userDetail: UserDetail): Promise<Signature | null> {
  const newestSignatureId = userDetail.signatures.at(-1);
  if (newestSignatureId == undefined) return null;

  const signature = await StorageService.Signatures.get(newestSignatureId);
  if (!signatureIsValidForUser(userDetail, signature)) {
    return null;
  }

  return signature;
}

export async function userHasValidSignature(userDetail: UserDetail): Promise<boolean> {
  return (await getValidUserSignature(userDetail)) != null;
}

/**
 * The single maintainer of the `tasks.signAgreement` flag, which is the one variable every
 * signature-requirement consumer reads. A valid signature clears the task; lacking one, the task is
 * set when the customer has an open rent/loan order or holds an active rent/loan item. A task that
 * was requested elsewhere (provisioning, signature link) is a demand that stays until signed.
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
        signatureRequiringItemTypes.has(orderItem.type) && orderActive.isOrderItemActive(orderItem),
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
    (customerItem) =>
      customerItem.handout &&
      customerItemActive.isActive(customerItem) &&
      signatureRequiringItemTypes.has(customerItem.type ?? "rent"),
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

function signatureIsValidForUser(userDetail: UserDetail, signature: SignatureMetadata): boolean {
  if (isSignatureExpired(signature)) {
    return false;
  }

  return isUnderage(userDetail) === signature.signedByGuardian;
}

export function isUnderage(userDetail: UserDetail): boolean {
  const now = new Date();
  const latestAdultBirthDate = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  return userDetail.dob > latestAdultBirthDate;
}

function isSignatureExpired(signature: SignatureMetadata): boolean {
  const now = new Date();
  const oldestAllowedSignatureTime = new Date(
    now.getFullYear(),
    now.getMonth() - SIGNATURE_NUM_MONTHS_VALID,
    now.getDate(),
  );

  // @ts-expect-error creationTime is required by bl-document, thus is always present
  return signature.creationTime < oldestAllowedSignatureTime;
}
