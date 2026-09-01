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
    message: "Gi nettleseren tilgang til kameraet for å skanne, eller skriv inn koden manuelt.",
  },
  "no-camera": {
    title: "Fant ikke noe kamera",
    message: "Denne enheten har ikke et kamera vi kan bruke. Skriv inn koden manuelt.",
  },
  "in-use": {
    title: "Kameraet er i bruk",
    message: "Lukk andre apper eller faner som bruker kameraet, og prøv igjen.",
  },
  "insecure-context": {
    title: "Kameraet krever en sikker tilkobling",
    message: "Siden må åpnes over https for å bruke kameraet. Skriv inn koden manuelt.",
  },
  unsupported: {
    title: "Skanning støttes ikke",
    message: "Nettleseren din støtter ikke skanning. Skriv inn koden manuelt.",
  },
  overconstrained: {
    title: "Kameraet støtter ikke innstillingene",
    message: "Prøv igjen, eller skriv inn koden manuelt.",
  },
  aborted: {
    title: "Kameraet startet ikke",
    message: "Prøv igjen, eller skriv inn koden manuelt.",
  },
  security: {
    title: "Nettleseren blokkerte kameraet",
    message: "Sjekk personverninnstillingene i nettleseren, og prøv igjen.",
  },
  "type-error": {
    title: "Klarte ikke starte kameraet",
    message: "Prøv igjen, eller skriv inn koden manuelt.",
  },
  unknown: {
    title: "Klarte ikke starte kameraet",
    message: "Prøv igjen, eller skriv inn koden manuelt.",
  },
};

export default function CameraErrorAlert({
  error,
  onRetry,
}: {
  error: IScannerError;
  onRetry: () => void;
}) {
  const copy = CAMERA_ERROR_COPY[error.kind] ?? CAMERA_ERROR_COPY.unknown;

  return (
    <WarningAlert title={copy.title}>
      <Stack gap="xs" align="flex-start">
        {copy.message}
        {RETRY_WORTH_IT.has(error.kind) && (
          <Button size="xs" variant="outline" onClick={onRetry}>
            Prøv igjen
          </Button>
        )}
      </Stack>
    </WarningAlert>
  );
}
