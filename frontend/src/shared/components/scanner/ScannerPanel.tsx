import type { IScannerError } from "@yudiel/react-qr-scanner";
import { Box, Button, Modal, Stack } from "@mantine/core";
import * as Sentry from "@sentry/tanstackstart-react";
import { IconForms } from "@tabler/icons-react";
import { useState } from "react";
import type { ReactNode } from "react";

import WarningAlert from "@/shared/components/alerts/WarningAlert";
import CameraErrorAlert from "@/shared/components/scanner/CameraErrorAlert";
import CameraScanner from "@/shared/components/scanner/CameraScanner";
import ManualCodeEntry from "@/shared/components/scanner/ManualCodeEntry";
import ScanInstructionBlock from "@/shared/components/scanner/ScanInstructionBlock";
import type { ScanInstruction } from "@/shared/components/scanner/ScanInstructionBlock";
import { GENERIC_ERROR_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import { describeRejectedScan, determineScanCodeType } from "@/shared/utils/scanCodes";
import type { ScanCodeType } from "@/shared/utils/scanCodes";

export interface ScanNotice {
  message: string;
  title?: string | undefined;
}

export interface ScannerPanelProps {
  onScan: (code: string) => Promise<ScanNotice | void> | ScanNotice | void;
  accepts?: ScanCodeType[] | undefined;
  instruction?: ScanInstruction | null | undefined;
  /** Rendered inside the instruction strip, under the instruction (a type picker). */
  instructionAddon?: ReactNode;
  successMessage?: string | undefined;
  onSuccess?: (() => void) | undefined;
  /**
   * true: always offer typing the code; false: never (the page has another way, e.g. a search);
   * unset: only as a way out when the camera will not start.
   */
  allowManualEntry?: boolean | undefined;
  children?: ReactNode;
}

/** The scanner's housing: dark in either colour scheme, since the video it frames is arbitrary. */
const SCANNER_HOUSING_COLOR = "rgb(9, 11, 16)";

// Mantine modals default to z-index 200. The panel usually renders inside one, so its own modals
// have to outrank the host rather than rely on portal ordering.
const MANUAL_ENTRY_Z_INDEX = 300;
const NOTICE_Z_INDEX = 400;

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
  instructionAddon,
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

  // Nobody types a customer's 24-character id by hand; the manual entry is for stickers and ISBNs
  // whose print is unreadable. So it takes every accepted type but that one.
  const manualAccepts = accepts?.filter((type) => type !== "customerId");
  const manualEntryAvailable =
    manualAccepts?.length !== 0 &&
    (allowManualEntry === true || (allowManualEntry === undefined && cameraError !== null));

  return (
    <Stack>
      {cameraError === null ? (
        // One dark block, like the scanner's own housing: the video framed inside it, with the
        // instruction and its controls underneath on the same ground
        <Box
          p="xs"
          style={{
            borderRadius: "var(--mantine-radius-md)",
            background: SCANNER_HOUSING_COLOR,
            color: "#FFFFFF",
          }}
        >
          <Box style={{ borderRadius: "var(--mantine-radius-sm)", overflow: "hidden" }}>
            <CameraScanner
              key={cameraAttempt}
              accepts={accepts}
              active={notice?.open !== true && !manualEntryOpen}
              onCode={handleCode}
              onCameraError={setCameraError}
            />
          </Box>
          {instruction && (
            <ScanInstructionBlock instruction={instruction}>
              {instructionAddon}
            </ScanInstructionBlock>
          )}
        </Box>
      ) : (
        <CameraErrorAlert
          error={cameraError}
          manualEntry={manualEntryAvailable}
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
        <ManualCodeEntry accepts={manualAccepts} onSubmit={handleCode} />
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
