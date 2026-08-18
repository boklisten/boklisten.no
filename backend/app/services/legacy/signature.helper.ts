import logger from "@adonisjs/core/services/logger";

import { Signature } from "#models/mongoose/signature.schema";
import { StorageService } from "#services/storage_service";
import { SIGNATURE_NUM_MONTHS_VALID, SignatureMetadata } from "#shared/serialized-signature";
import { UserDetail } from "#shared/user-detail";

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

export async function verifyCustomerSignature(customerId: string): Promise<string | null> {
  const userDetail = await StorageService.UserDetails.getOrNull(customerId);
  if (userDetail && (await userHasValidSignature(userDetail))) {
    return null;
  }
  return "Kunden mangler gyldig signatur, og kan derfor ikke få utdelt bøker. Be kunden signere først.";
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

// NodeJS will by default ignore non-base64 characters, which can lead to issues
export async function signOrders(userDetail: UserDetail) {
  if (!(userDetail.orders && userDetail.orders.length > 0)) {
    return;
  }
  const orders = await StorageService.Orders.getMany(userDetail.orders);
  await Promise.all(
    orders
      .filter((order) => order.pendingSignature)
      .map(async (order) => {
        return await StorageService.Orders.update(order.id, {
          pendingSignature: false,
        }).catch((error) =>
          logger.error(
            `While processing new signature, unable to update order ${order.id}: ${error}`,
          ),
        );
      }),
  );
}
