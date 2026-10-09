export type AuthVippsError = "access_denied" | "expired" | "email_in_use" | "error";

export const AUTH_VIPPS_ERROR = {
  ACCESS_DENIED: "access_denied",
  EXPIRED: "expired",
  /** Vipps has not verified the email, and another account has it. */
  EMAIL_IN_USE: "email_in_use",
  ERROR: "error",
} as const satisfies Record<Uppercase<AuthVippsError>, AuthVippsError>;
