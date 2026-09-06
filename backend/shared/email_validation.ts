/** Where an address validation was requested from; forwarded to SendGrid as `source` for their stats. */
export const EMAIL_VALIDATION_SOURCES = ["signup", "guardian", "administrate"] as const;
export type EmailValidationSource = (typeof EMAIL_VALIDATION_SOURCES)[number];

export type EmailValidationVerdict = "Valid" | "Risky" | "Invalid";

/** The reasons SendGrid can flag an address with; each maps to one line of feedback in the UI. */
export interface EmailValidationChecks {
  hasValidAddressSyntax: boolean;
  hasMxOrARecord: boolean;
  isSuspectedDisposableAddress: boolean;
  isSuspectedRoleAddress: boolean;
  hasKnownBounces: boolean;
  hasSuspectedBounces: boolean;
}

export type EmailValidationResult =
  /** No key configured, SendGrid unreachable, or the address could not be checked. */
  | { available: false }
  | {
      available: true;
      verdict: EmailValidationVerdict;
      /** The whole corrected address when SendGrid spots a domain typo, e.g. solan@gmail.con → solan@gmail.com. */
      suggestion: string | null;
      checks: EmailValidationChecks;
    };
