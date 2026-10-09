import { randomInt } from "node:crypto";

import hash from "@adonisjs/core/services/hash";
import db from "@adonisjs/lucid/services/db";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";
import * as Sentry from "@sentry/node";
import { DateTime } from "luxon";

import SmsCode from "#models/sms_code";
import type { SmsCodePurpose } from "#models/sms_code";
import DispatchService from "#services/dispatch_service";
import { clientOrigin, isDeployed } from "#config/app";

const CODE_LENGTH = 6;
const VALID_MINUTES = 10;
/** Wrong guesses one code survives; with six digits that leaves 5 in a million per code. */
const MAX_ATTEMPTS = 5;
/** A new code for the same number replaces the last one, but not sooner than this. */
const RESEND_AFTER_SECONDS = 30;
/**
 * Codes sent in the last hour that make Sentry warn: a run on our SMS budget or on guessing. The
 * busiest hour of sign-ups so far had 359. Sending carries on; someone decides what to do.
 */
const HOURLY_WARNING = 500;
/** Undeployed, every code is this one and no SMS goes out. */
export const LOCAL_CODE = "000000";

/** Who a code is for: a number, and for a phone change also the user changing to it. */
export interface SmsCodeTarget {
  phone: string;
  purpose: SmsCodePurpose;
  userId: string | null;
}

export type SmsCodeCheck = "valid" | "wrong" | "expired";

export const SMS_CODE_MESSAGES = {
  wrong: "Koden stemmer ikke. Sjekk SMS-en og prøv igjen.",
  expired: "Koden er utløpt eller brukt opp. Be om en ny kode.",
} as const satisfies Record<Exclude<SmsCodeCheck, "valid">, string>;

function codesFor({ phone, purpose, userId }: SmsCodeTarget, client?: TransactionClientContract) {
  const query = SmsCode.query({ client }).where("phone", phone).where("purpose", purpose);
  return userId === null ? query.whereNull("userId") : query.where("userId", userId);
}

/**
 * What the code is for and the code. The last line is the origin-bound format browsers read to
 * offer the code above the keyboard (WebOTP); it only matches on the site's own host.
 */
function smsText(purpose: SmsCodePurpose, code: string): string {
  const intro =
    purpose === "login"
      ? `Engangskoden din for Boklisten er ${code}.`
      : `Engangskoden din for å bekrefte nytt mobilnummer hos Boklisten er ${code}.`;
  return `${intro}\n\n@${new URL(clientOrigin).hostname} #${code}`;
}

/** Warns once, as the hour's count of codes reaches the threshold. */
async function warnOnHourlyVolume(): Promise<void> {
  const { rows } = await db.rawQuery<{ rows: { count: string }[] }>(
    `SELECT count(*) FROM messages
     WHERE message_type IN ('login-code', 'phone-verification')
       AND created_at > now() - interval '1 hour'`,
  );
  if (Number(rows[0]?.count) === HOURLY_WARNING) {
    Sentry.captureMessage(`${HOURLY_WARNING} engangskoder sendt på SMS den siste timen`, "warning");
  }
}

export const SmsCodeService = {
  localCode: isDeployed ? null : (LOCAL_CODE as string | null),

  /**
   * Sends a fresh code to the number, replacing any earlier one for the same target. When the
   * last code went out too recently nothing is sent, and the answer is what to tell the user.
   */
  async issue(target: SmsCodeTarget, customerId: string | null): Promise<string | null> {
    await SmsCode.query().whereRaw("expires_at < now()").delete();

    const { localCode } = SmsCodeService;
    const code = localCode ?? String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
    const codeHash = await hash.make(code);
    // One request per target at a time, so the pause between codes holds for parallel requests
    // too; the unique index on the target is the backstop.
    const refusal = await db.transaction(async (trx) => {
      const { phone, purpose, userId } = target;
      await trx.rawQuery("SELECT pg_advisory_xact_lock(hashtext(?))", [
        `sms_code:${phone}:${purpose}:${userId ?? ""}`,
      ]);
      const latest = await codesFor(target, trx).first();
      const waited = latest ? DateTime.now().diff(latest.createdAt, "seconds").seconds : Infinity;
      if (localCode === null && waited < RESEND_AFTER_SECONDS) {
        return `Vent ${Math.ceil(RESEND_AFTER_SECONDS - waited)} sekunder før du ber om en ny kode.`;
      }
      await latest?.delete();
      await SmsCode.create(
        { ...target, codeHash, expiresAt: DateTime.now().plus({ minutes: VALID_MINUTES }) },
        { client: trx },
      );
      return null;
    });
    if (refusal || localCode !== null) {
      return refusal;
    }
    await DispatchService.sendSmsCode({
      phone: target.phone,
      body: smsText(target.purpose, code),
      loggedBody: smsText(target.purpose, "•".repeat(CODE_LENGTH)),
      customerId,
      messageType: target.purpose === "login" ? "login-code" : "phone-verification",
    });
    await warnOnHourlyVolume();
    return null;
  },

  /**
   * Checks a typed code. Every check spends an attempt before the comparison, in one statement,
   * so parallel guesses cannot get past the limit; a valid code is used up.
   */
  async check(target: SmsCodeTarget, code: string): Promise<SmsCodeCheck> {
    const { rows } = await db.rawQuery<{ rows: { id: number; code_hash: string }[] }>(
      `UPDATE sms_codes SET attempts = attempts + 1
       WHERE phone = ? AND purpose = ? AND user_id IS NOT DISTINCT FROM ?
         AND expires_at > now() AND attempts < ?
       RETURNING id, code_hash`,
      [target.phone, target.purpose, target.userId, MAX_ATTEMPTS],
    );
    const [row] = rows;
    if (!row) {
      return "expired";
    }
    if (!(await hash.verify(row.code_hash, code))) {
      return "wrong";
    }
    await SmsCode.query().where("id", row.id).delete();
    return "valid";
  },
};
