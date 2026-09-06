import logger from "@adonisjs/core/services/logger";

import type { EmailValidationResult, EmailValidationSource } from "#shared/email_validation";
import env from "#start/env";
import { sendgridEmailValidationResponseValidator } from "#validators/email_validation";

export const SENDGRID_EMAIL_VALIDATION_URL = "https://api.sendgrid.com/v3/validations/email";
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Asks SendGrid's Email Address Validation API how deliverable an address looks. Purely
 * advisory: every failure path yields `{ available: false }` so callers can never be blocked
 * by a missing key, an outage, or a rate limit. Needs a dedicated key with only the
 * "Email Address Validation" scope, separate from the sending key.
 */
export const EmailValidationService = {
  async check(email: string, source: EmailValidationSource): Promise<EmailValidationResult> {
    const apiKey = env.get("SENDGRID_EMAIL_VALIDATION_API_KEY");
    if (!apiKey) {
      return { available: false };
    }

    try {
      const response = await fetch(SENDGRID_EMAIL_VALIDATION_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, source }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn(`SendGrid email validation responded ${response.status}`);
        return { available: false };
      }

      const [validationError, data] = await sendgridEmailValidationResponseValidator.tryValidate(
        await response.json(),
      );
      if (validationError || !data) {
        logger.warn("SendGrid email validation returned an unexpected body");
        return { available: false };
      }

      const { verdict, local, suggestion, checks } = data.result;
      return {
        available: true,
        verdict,
        // SendGrid suggests a corrected domain only ("gmail.com" for "gmail.con"); the UI offers
        // a whole address so one click fixes the field.
        suggestion: suggestion ? `${local}@${suggestion}` : null,
        checks: {
          hasValidAddressSyntax: checks.domain.has_valid_address_syntax,
          hasMxOrARecord: checks.domain.has_mx_or_a_record,
          isSuspectedDisposableAddress: checks.domain.is_suspected_disposable_address,
          isSuspectedRoleAddress: checks.local_part.is_suspected_role_address,
          hasKnownBounces: checks.additional.has_known_bounces,
          hasSuspectedBounces: checks.additional.has_suspected_bounces,
        },
      };
    } catch (error) {
      logger.warn(`SendGrid email validation failed: ${String(error)}`);
      return { available: false };
    }
  },
};
