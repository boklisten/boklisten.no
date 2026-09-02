import type { IScannerError } from "@yudiel/react-qr-scanner";
import { Button, Modal, Stack } from "@mantine/core";
import type { NotificationData } from "@mantine/notifications";
import * as Sentry from "@sentry/tanstackstart-react";
import { IconForms } from "@tabler/icons-react";
import { useState } from "react";
import type { ReactNode } from "react";

import WarningAlert from "@/shared/components/alerts/WarningAlert";
import CameraErrorAlert from "@/shared/components/scanner/CameraErrorAlert";
import CameraScanner from "@/shared/components/scanner/CameraScanner";
import ManualCodeEntry from "@/shared/components/scanner/ManualCodeEntry";
import ScanInstructionOverlay from "@/shared/components/scanner/ScanInstructionOverlay";
import type { ScanInstruction } from "@/shared/components/scanner/ScanInstructionOverlay";
import { GENERIC_ERROR_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import {
  determineScanCodeType,
  listScanCodeTypes,
  nameScanCodeType,
} from "@/shared/utils/scanCodes";
import type { ScanCodeType } from "@/shared/utils/scanCodes";

export interface ScanNotice {
  message: string;
  title?: string | undefined;
}

export interface ScannerPanelProps {
  onScan: (code: string) => Promise<ScanNotice | void> | ScanNotice | void;
  accepts?: ScanCodeType[] | undefined;
  instruction?: ScanInstruction | null | undefined;
  successMessage?: string | undefined;
  onSuccess?: (() => void) | undefined;
  allowManualEntry?: boolean | undefined;
  children?: ReactNode;
}

// Mantine modals default to z-index 200. The panel usually renders inside one, so its own modals
// have to outrank the host rather than rely on portal ordering.
const MANUAL_ENTRY_Z_INDEX = 300;
const NOTICE_Z_INDEX = 400;

function locateHint(type: ScanCodeType): string {
  switch (type) {
    case "blid": {
      return "Bruk bokas unike ID — se instruksjoner for hjelp.";
    }
    case "isbn": {
      return "Skann bokas ISBN — strekkoden med 13 siffer, vanligvis på baksiden av boka.";
    }
    case "customerId": {
      return "Kunden finner kunde-ID-en sin under «Vis kunde-ID» på boklisten.no.";
    }
    default: {
      return "Prøv igjen, eller ta kontakt med stand for hjelp.";
    }
  }
}

function describeRejectedScan(scanned: ScanCodeType, accepted: ScanCodeType[]): NotificationData {
  const hint =
    accepted.length === 1 && accepted[0] !== undefined
      ? locateHint(accepted[0])
      : `Skann ${listScanCodeTypes(accepted)}.`;

  if (scanned === "unknown") {
    return { title: "Ugyldig strekkode", message: `Denne koden kjenner vi ikke igjen. ${hint}` };
  }
  return { title: "Feil strekkode", message: `Du skannet ${nameScanCodeType(scanned)}. ${hint}` };
}

function vibrate() {
  if (typeof navigator === "undefined") {
    return;
  }
  try {
    navigator.vibrate?.(100);
  } catch {
    // Vibration is unavailable on desktop and blocked in some embedded browsers.
  }
}

export default function ScannerPanel({
  onScan,
  accepts,
  instruction,
  successMessage,
  onSuccess,
  allowManualEntry,
  children,
}: ScannerPanelProps) {
  const [notice, setNotice] = useState<{ content: ScanNotice; open: boolean } | null>(null);
  const showNotice = (content: ScanNotice) => setNotice({ content, open: true });
  const dismissNotice = () =>
    setNotice((current) => (current === null ? null : { ...current, open: false }));
  const [cameraError, setCameraError] = useState<IScannerError | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);

  const handleCode = async (code: string) => {
    const scannedType = determineScanCodeType(code);
    if (accepts !== undefined && !accepts.includes(scannedType)) {
      showErrorNotification(describeRejectedScan(scannedType, accepts));
      return;
    }

    let succeeded = false;
    try {
      const outcome = (await onScan(code)) ?? null;
      vibrate();
      setManualEntryOpen(false);
      if (outcome === null) {
        dismissNotice();
        if (successMessage !== undefined) {
          showSuccessNotification(successMessage);
        }
        succeeded = true;
      } else {
        showNotice(outcome);
      }
    } catch (error) {
      console.error("Failed to handle scanned code", error);
      Sentry.captureException(error);
      showErrorNotification(GENERIC_ERROR_TEXT);
    }

    if (succeeded) {
      onSuccess?.();
    }
  };

  const manualEntryAvailable = allowManualEntry === true || cameraError !== null;

  return (
    <Stack>
      {cameraError === null ? (
        <CameraScanner
          key={cameraAttempt}
          accepts={accepts}
          active={notice?.open !== true && !manualEntryOpen}
          onCode={handleCode}
          onCameraError={setCameraError}
        >
          {instruction ? <ScanInstructionOverlay instruction={instruction} /> : null}
        </CameraScanner>
      ) : (
        <CameraErrorAlert
          error={cameraError}
          onRetry={() => {
            setCameraError(null);
            setCameraAttempt((attempt) => attempt + 1);
          }}
        />
      )}

      {children}

      {manualEntryAvailable && (
        <Button
          variant="outline"
          leftSection={<IconForms />}
          onClick={() => setManualEntryOpen(true)}
        >
          Skriv inn koden manuelt
        </Button>
      )}

      <Modal
        opened={manualEntryOpen}
        onClose={() => setManualEntryOpen(false)}
        title="Manuell registrering"
        zIndex={MANUAL_ENTRY_Z_INDEX}
      >
        <ManualCodeEntry accepts={accepts} onSubmit={handleCode} />
      </Modal>

      <Modal
        opened={notice?.open === true}
        onClose={dismissNotice}
        title={notice?.content.title ?? "Viktig informasjon"}
        zIndex={NOTICE_Z_INDEX}
      >
        <Stack>
          <WarningAlert>{notice?.content.message}</WarningAlert>
          <Button onClick={dismissNotice}>OK</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
