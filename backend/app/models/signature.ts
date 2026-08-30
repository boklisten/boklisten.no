import { scope } from "@adonisjs/lucid/orm";
import { DateTime } from "luxon";

import { SignatureSchema } from "#database/schema";

export const SIGNATURE_NUM_MONTHS_VALID = 4 * 12;

export default class Signature extends SignatureSchema {
  static newestFirst = scope((query) => {
    void query.orderBy("createdAt", "desc").orderBy("id", "desc");
  });

  /**
   * The newest signature for the customer, when it is still valid for them. Only the newest
   * signature is judged: a newer invalid signature shadows older valid ones, so the customer must
   * sign again.
   */
  static async validForCustomer(userDetail: {
    id: string;
    dob?: Date | null;
  }): Promise<Signature | null> {
    const newestSignature = await this.query()
      .where("customerDetailsId", userDetail.id)
      .withScopes((scopes) => scopes.newestFirst())
      .first();
    return newestSignature?.isValidFor(userDetail) ? newestSignature : null;
  }

  /**
   * The newest signature for each of the given customers, without the image payload.
   */
  static async newestPerCustomer(customerDetailsIds: string[]): Promise<Signature[]> {
    return await this.query()
      .select("id", "customerDetailsId", "signedByGuardian", "createdAt")
      .whereIn("customerDetailsId", customerDetailsIds)
      .distinctOn("customerDetailsId")
      .orderBy("customerDetailsId")
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
          .whereColumn("newer.customer_details_id", "signatures.customer_details_id")
          .whereRaw(
            '("newer"."created_at", "newer"."id") > ("signatures"."created_at", "signatures"."id")',
          );
      })
      .withScopes((scopes) => scopes.newestFirst())
      .limit(limit);
    if (cursor) {
      void query.whereRaw('("created_at", "id") < (?, ?)', [cursor.createdAt, cursor.id]);
    }
    return await query;
  }

  static async reassignCustomer(fromDetailsId: string, toDetailsId: string): Promise<void> {
    await this.query()
      .where("customerDetailsId", fromDetailsId)
      .update({ customerDetailsId: toDetailsId });
  }

  /**
   * A signature is valid for a customer while it is within the validity window and was signed by
   * the right hand: a guardian for an underage customer, the customer themselves otherwise.
   */
  isValidFor(userDetail: { dob?: Date | null }): boolean {
    if (this.isExpired()) return false;
    return isUnderage(userDetail) === this.signedByGuardian;
  }

  private isExpired(): boolean {
    if (!this.createdAt) return false;
    const now = new Date();
    const oldestAllowedSignatureTime = new Date(
      now.getFullYear(),
      now.getMonth() - SIGNATURE_NUM_MONTHS_VALID,
      now.getDate(),
    );
    return this.createdAt.toJSDate() < oldestAllowedSignatureTime;
  }

  get expiresAt(): DateTime | null {
    return this.createdAt?.plus({ months: SIGNATURE_NUM_MONTHS_VALID }) ?? null;
  }

  /**
   * When the signature actually stops being valid for this customer: a guardian signature dies on
   * the customer's 18th birthday (isValidFor starts rejecting it), if that comes before the
   * ordinary validity window runs out.
   */
  expiresAtFor(userDetail: { dob?: Date | null }): DateTime | null {
    const expiresAt = this.expiresAt;
    if (!this.signedByGuardian || !userDetail.dob) return expiresAt;
    const eighteenthBirthday = DateTime.fromJSDate(userDetail.dob).plus({ years: 18 });
    if (!expiresAt) return eighteenthBirthday;
    return expiresAt < eighteenthBirthday ? expiresAt : eighteenthBirthday;
  }
}

export function isUnderage(userDetail: { dob?: Date | null }): boolean {
  if (!userDetail.dob) return false;
  const now = new Date();
  const latestAdultBirthDate = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  return userDetail.dob > latestAdultBirthDate;
}
