import { SmsCodeSchema } from "#database/schema";

/** `login` logs in (or starts a sign-up) by phone; `phone-change` proves a user's new number. */
export type SmsCodePurpose = "login" | "phone-change";

/** A one-time code sent by SMS, stored hashed until it is used (see `SmsCodeService`). */
export default class SmsCode extends SmsCodeSchema {
  declare purpose: SmsCodePurpose;
}
