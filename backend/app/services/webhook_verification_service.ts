import { createPublicKey, verify as verifyCryptoSignature } from "node:crypto";

import logger from "@adonisjs/core/services/logger";

/**
 * Verifies SendGrid's signed event webhook: an ECDSA (P-256, SHA-256) signature over
 * `timestamp + raw body`. The verification key is the base64 public key shown in the webhook's
 * settings in the SendGrid dashboard.
 */
export function verifySendgridSignature({
  publicKeyBase64,
  rawBody,
  signature,
  timestamp,
}: {
  publicKeyBase64: string;
  rawBody: string;
  signature: string;
  timestamp: string;
}): boolean {
  try {
    const publicKey = createPublicKey(
      `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`,
    );
    return verifyCryptoSignature(
      "sha256",
      Buffer.from(timestamp + rawBody),
      publicKey,
      Buffer.from(signature, "base64"),
    );
  } catch (error) {
    logger.error(`failed to verify SendGrid webhook signature: ${String(error)}`);
    return false;
  }
}
