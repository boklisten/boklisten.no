import { createHash, randomBytes } from "node:crypto";

import encryption from "@adonisjs/core/services/encryption";
import { DateTime } from "luxon";

import SignatureLink from "#models/signature_link";
import User from "#models/user";
import { clientOrigin } from "#config/app";

const VALID_DAYS = 30;
/** A link this close to expiring is replaced rather than sent or copied again. */
const REUSE_MIN_DAYS_LEFT = 7;
const ENCRYPTION_PURPOSE = "signature-link";

function hashOf(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function urlOf(token: string): string {
  return `${clientOrigin}/signering/${token}`;
}

/**
 * The links a customer or their guardian signs the loan agreement through. The token in the link
 * is the only credential, so it is random (256 bits), and one link per customer is live at a time:
 * every email, SMS and copied link carries the same token until it nears its expiry.
 */
export const SignatureLinkService = {
  /** The customer's signing link: the live one while it has time left, else a fresh one. */
  async urlFor(customer: Pick<User, "id">): Promise<string> {
    const existing = await SignatureLink.findBy("userId", customer.id);
    if (existing && existing.expiresAt > DateTime.now().plus({ days: REUSE_MIN_DAYS_LEFT })) {
      const token = encryption.decrypt<string>(existing.tokenEncrypted, ENCRYPTION_PURPOSE);
      if (token) {
        return urlOf(token);
      }
    }

    const token = randomBytes(32).toString("base64url");
    await SignatureLink.updateOrCreate(
      { userId: customer.id },
      {
        tokenHash: hashOf(token),
        tokenEncrypted: encryption.encrypt(token, undefined, ENCRYPTION_PURPOSE),
        expiresAt: DateTime.now().plus({ days: VALID_DAYS }),
      },
    );
    return urlOf(token);
  },

  /** The customer an unexpired link was issued for, or null for an unknown or expired token. */
  async customerFor(token: string): Promise<User | null> {
    const link = await SignatureLink.query()
      .where("tokenHash", hashOf(token))
      .where("expiresAt", ">", DateTime.now().toSQL())
      .first();
    return link ? User.find(link.userId) : null;
  },
};
