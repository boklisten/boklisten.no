export type AuthVippsError =
  | "access_denied"
  | "expired"
  | "email_in_use"
  | "outdated_app_version"
  | "wrong_challenge"
  | "error";

export const AUTH_VIPPS_ERROR = {
  ACCESS_DENIED: "access_denied",
  EXPIRED: "expired",
  /** Vipps has not verified the email, and another account has it. */
  EMAIL_IN_USE: "email_in_use",
  /** The customer's Vipps app is too old for the login flow. */
  OUTDATED_APP_VERSION: "outdated_app_version",
  /** The customer picked another number in the app than the one the browser showed. */
  WRONG_CHALLENGE: "wrong_challenge",
  ERROR: "error",
} as const satisfies Record<Uppercase<AuthVippsError>, AuthVippsError>;
