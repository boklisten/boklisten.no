import { scope } from "@adonisjs/lucid/orm";
import { DateTime } from "luxon";

import { SignatureSchema } from "#database/schema";

export const SIGNATURE_NUM_MONTHS_VALID = 4 * 12;

/** Every column but the image, which only the pages showing the signature need. */
const WITHOUT_IMAGE = ["id", "customerId", "signingName", "signedByGuardian", "createdAt"];

export default class Signature extends SignatureSchema {
  static newestFirst = scope((query) => {
    void query.orderBy("createdAt", "desc").orderBy("id", "desc");
  });

  /**
   * The newest signature for the customer, when it is still valid for them. Only the newest
   * signature is judged: a newer invalid signature shadows older valid ones, so the customer must
   * sign again.
   */
  static async validForCustomer(customer: {
    id: string;
    dob: DateTime | null;
  }): Promise<Signature | null> {
    const newestSignature = await this.newestForCustomer(customer.id);
    return newestSignature?.isValidFor(customer) ? newestSignature : null;
  }

  static async newestForCustomer(
    customerId: string,
    { withImage = false } = {},
  ): Promise<Signature | null> {
    const query = this.query()
      .where("customerId", customerId)
      .withScopes((scopes) => scopes.newestFirst());
    if (!withImage) {
      void query.select(WITHOUT_IMAGE);
    }
    return query.first();
  }

  /**
   * The newest signature for each of the given customers, without the image payload.
   */
  static async newestPerCustomer(customerIds: string[]): Promise<Signature[]> {
    return this.query()
      .select(WITHOUT_IMAGE)
      .whereIn("customerId", customerIds)
      .distinctOn("customerId")
      .orderBy("customerId")
      .withScopes((scopes) => scopes.newestFirst());
  }

  /**
   * A keyset page of the newest signature per customer, ordered newest first. The cursor points at
   * the last row of the previous page; rows at or before it are excluded.
   */
  static async newestPerCustomerPage(
    cursor: { createdAt: Date; id: number } | null,
    limit: number,
  ): Promise<Signature[]> {
    const query = this.query()
      .whereNotExists((newer) => {
        void newer
          .from("signatures as newer")
          .whereColumn("newer.customer_id", "signatures.customer_id")
          .whereRaw(
            '("newer"."created_at", "newer"."id") > ("signatures"."created_at", "signatures"."id")',
          );
      })
      .withScopes((scopes) => scopes.newestFirst())
      .limit(limit);
    if (cursor) {
      void query.whereRaw('("created_at", "id") < (?, ?)', [cursor.createdAt, cursor.id]);
    }
    return query;
  }

  /**
   * A signature is valid for a customer while it is within the validity window and was signed by
   * the right hand: a guardian for an underage customer, the customer themselves otherwise.
   */
  isValidFor(customer: { dob: DateTime | null }): boolean {
    if (this.isExpired()) {
      return false;
    }
    return isUnderage(customer) === this.signedByGuardian;
  }

  /**
   * A guardian signature that only stopped counting because the customer has turned 18: still
   * inside the validity window, but the customer must now sign for themselves.
   */
  isOutgrownGuardianFor(customer: { dob: DateTime | null }): boolean {
    return this.signedByGuardian && !this.isExpired() && !isUnderage(customer);
  }

  isExpired(): boolean {
    if (!this.createdAt) {
      return false;
    }
    const now = new Date();
    const oldestAllowedSignatureTime = new Date(
      now.getFullYear(),
      now.getMonth() - SIGNATURE_NUM_MONTHS_VALID,
      now.getDate(),
    );
    return this.createdAt.toJSDate() < oldestAllowedSignatureTime;
  }

  get expiresAt(): DateTime {
    return this.createdAt.plus({ months: SIGNATURE_NUM_MONTHS_VALID });
  }

  /**
   * When the signature actually stops being valid for this customer: a guardian signature dies on
   * the customer's 18th birthday (isValidFor starts rejecting it), if that comes before the
   * ordinary validity window runs out.
   */
  expiresAtFor(customer: { dob: DateTime | null }): DateTime {
    const { expiresAt } = this;
    if (!this.signedByGuardian || !customer.dob) {
      return expiresAt;
    }
    const eighteenthBirthday = customer.dob.plus({ years: 18 });
    return expiresAt < eighteenthBirthday ? expiresAt : eighteenthBirthday;
  }
}

/** Younger than 18 today, by calendar date; unknown dates of birth count as adult. */
export function isUnderage(customer: { dob: DateTime | null }): boolean {
  if (!customer.dob) {
    return false;
  }
  const latestAdultBirthDate = DateTime.now().startOf("day").minus({ years: 18 });
  return customer.dob.startOf("day") > latestAdultBirthDate;
}
