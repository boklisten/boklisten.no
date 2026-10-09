import type { AuthVippsError } from "@boklisten/backend/shared/auth_vipps_error";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

const REASONS: Record<AuthVippsError, { title: string; text: string }> = {
  access_denied: { title: "Du har avbrutt innloggingsprosessen", text: PLEASE_TRY_AGAIN_TEXT },
  expired: { title: "Forespørselen din har utløpt", text: PLEASE_TRY_AGAIN_TEXT },
  email_in_use: {
    title: "E-postadressen er allerede i bruk",
    text: "En annen konto bruker e-postadressen fra Vipps, og Vipps har ikke bekreftet at den er din. Bekreft e-postadressen i Vipps-appen, eller logg inn med SMS.",
  },
  outdated_app_version: {
    title: "Vipps-appen må oppdateres",
    text: "Oppdater Vipps-appen og prøv igjen.",
  },
  wrong_challenge: {
    title: "Feil tall ble valgt",
    text: "Tallet du valgte i Vipps-appen var ikke det samme som tallet i nettleseren. Prøv igjen.",
  },
  error: { title: "Det skjedde en ukjent feil", text: PLEASE_TRY_AGAIN_TEXT },
};

function isKnownReason(reason: string): reason is AuthVippsError {
  return Object.hasOwn(REASONS, reason);
}

export default function AuthFailureReasonAlert({ reason }: { reason: string }) {
  const { title, text } = REASONS[isKnownReason(reason) ? reason : "error"];
  return <ErrorAlert title={title}>{text}</ErrorAlert>;
}
