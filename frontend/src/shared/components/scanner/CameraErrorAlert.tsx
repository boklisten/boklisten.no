import type { IScannerError, ScannerErrorKind } from "@yudiel/react-qr-scanner";
import { Button, Stack } from "@mantine/core";

import WarningAlert from "@/shared/components/alerts/WarningAlert";

const RETRY_WORTH_IT = new Set<ScannerErrorKind>([
  "in-use",
  "overconstrained",
  "aborted",
  "security",
  "type-error",
  "unknown",
]);

const CAMERA_ERROR_COPY: Record<ScannerErrorKind, { title: string; message: string }> = {
  "permission-denied": {
    title: "Ingen tilgang til kameraet",
    message: "Gi nettleseren tilgang til kameraet for å skanne.",
  },
  "no-camera": {
    title: "Fant ikke noe kamera",
    message: "Denne enheten har ikke et kamera vi kan bruke.",
  },
  "in-use": {
    title: "Kameraet er i bruk",
    message: "Lukk andre apper eller faner som bruker kameraet, og prøv igjen.",
  },
  "insecure-context": {
    title: "Kameraet krever en sikker tilkobling",
    message: "Siden må åpnes over https for å bruke kameraet.",
  },
  unsupported: {
    title: "Skanning støttes ikke",
    message: "Nettleseren din støtter ikke skanning.",
  },
  overconstrained: {
    title: "Kameraet støtter ikke innstillingene",
    message: "Prøv igjen.",
  },
  aborted: {
    title: "Kameraet startet ikke",
    message: "Prøv igjen.",
  },
  security: {
    title: "Nettleseren blokkerte kameraet",
    message: "Sjekk personverninnstillingene i nettleseren, og prøv igjen.",
  },
  "type-error": {
    title: "Klarte ikke starte kameraet",
    message: "Prøv igjen.",
  },
  unknown: {
    title: "Klarte ikke starte kameraet",
    message: "Prøv igjen.",
  },
};

/** The way out when the camera will not start, where the panel offers one. */
const MANUAL_ENTRY_HINT = "Du kan også skrive inn koden manuelt.";

export default function CameraErrorAlert({
  error,
  manualEntry,
  onRetry,
}: {
  error: IScannerError;
  /** Whether the panel shows its manual entry under this alert. */
  manualEntry: boolean;
  onRetry: () => void;
}) {
  const copy = CAMERA_ERROR_COPY[error.kind] ?? CAMERA_ERROR_COPY.unknown;

  return (
    <WarningAlert title={copy.title}>
      <Stack gap="xs" align="flex-start">
        {manualEntry ? `${copy.message} ${MANUAL_ENTRY_HINT}` : copy.message}
        {RETRY_WORTH_IT.has(error.kind) && (
          <Button size="xs" variant="outline" onClick={onRetry}>
            Prøv igjen
          </Button>
        )}
      </Stack>
    </WarningAlert>
  );
}
