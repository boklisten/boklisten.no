import { TuyauHTTPError } from "@tuyau/core/client";

import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

function waitText(seconds: number): string {
  if (seconds < 60) {
    return seconds === 1 ? "1 sekund" : `${seconds} sekunder`;
  }
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minutt" : `${minutes} minutter`;
}

/**
 * What a failed request for or with an SMS code tells the user: the wait for a rate-limited (429)
 * one, from the limiter's `Retry-After` header (seconds; the API exposes it to the browser), or
 * the first validation message.
 */
export function codeRequestErrorText(error: unknown): string {
  if (!(error instanceof TuyauHTTPError)) {
    return PLEASE_TRY_AGAIN_TEXT;
  }
  if (error.status === 429) {
    const seconds = Number(error.rawResponse?.headers.get("retry-after"));
    return Number.isFinite(seconds) && seconds > 0
      ? `For mange forsøk. Prøv igjen om ${waitText(Math.ceil(seconds))}.`
      : "For mange forsøk. Vent litt, og prøv igjen.";
  }
  return error.isValidationError()
    ? (error.response.errors[0]?.message ?? PLEASE_TRY_AGAIN_TEXT)
    : PLEASE_TRY_AGAIN_TEXT;
}
