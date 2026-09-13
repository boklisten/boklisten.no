import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconKeyboard } from "@tabler/icons-react";
import { useState } from "react";
import type { SubmitEvent } from "react";

import { isValidBlid } from "@/features/blid-search/validateBlid";
import ScanCodeIcon from "@/shared/components/scanner/ScanCodeIcon";
import ScanCodeIllustration from "@/shared/components/scanner/ScanCodeIllustration";
import type { ScanInstruction } from "@/shared/components/scanner/ScanInstructionBlock";
import openScannerModal from "@/shared/components/scanner/openScannerModal";
import useWedgeScanner from "@/shared/hooks/useWedgeScanner";
import { describeScanCodeLocation } from "@/shared/utils/scanCodes";

/** The same caption the Kasse camera shows for a book, so the sticker looks familiar everywhere. */
const BLID_SCAN_INSTRUCTION: ScanInstruction = { text: "Bokas unike ID", illustrate: "blid" };

/**
 * What to hunt for: the printed sticker itself next to where it sits on the book. Shown where the
 * customer is about to scan or type, since most have never noticed the sticker before.
 */
function BlidStickerHint({ scale }: { scale: number }) {
  return (
    <Group gap="sm" wrap="nowrap" justify="center">
      <ScanCodeIllustration type="blid" scale={scale} />
      <Stack gap={2} miw={0}>
        <Text fw={600} size="sm" lh={1.3}>
          {BLID_SCAN_INSTRUCTION.text}
        </Text>
        <Text size="sm" c="dimmed" lh={1.3}>
          {describeScanCodeLocation("blid")}
        </Text>
      </Stack>
    </Group>
  );
}

/**
 * The entry point for the public book lookup: scan with the camera, type an ID, or use a
 * physical barcode scanner at any time. Renders as a centered hero before the first search and as a
 * compact row once a result is showing, so the next book is always one scan away.
 */
export default function BlidSearchControls({
  onSubmit,
  compact,
}: {
  onSubmit: (blid: string) => void;
  compact: boolean;
}) {
  const [manualOpened, { open: openManual, close: closeManual }] = useDisclosure(false);
  useWedgeScanner({ accepts: ["blid"], onScan: onSubmit });

  const scanButton = (
    <Button
      size={compact ? "sm" : "lg"}
      radius="md"
      leftSection={<ScanCodeIcon accepts={["blid"]} size={compact ? 20 : 24} />}
      onClick={() =>
        openScannerModal({
          title: "Skann bøker",
          accepts: ["blid"],
          instruction: BLID_SCAN_INSTRUCTION,
          onScan: (blid) => {
            onSubmit(blid);
          },
        })
      }
    >
      Skann bøker
    </Button>
  );
  const manualButton = (
    <Button
      size={compact ? "sm" : "md"}
      variant="subtle"
      color="gray"
      leftSection={<IconKeyboard size={compact ? 18 : 20} aria-hidden />}
      onClick={openManual}
    >
      Skriv inn manuelt
    </Button>
  );

  return (
    <>
      {compact ? (
        <Group gap="xs">
          {scanButton}
          {manualButton}
        </Group>
      ) : (
        <Stack align="center" gap="md" py="xl">
          {scanButton}
          {manualButton}
        </Stack>
      )}
      <ManualBlidModal
        opened={manualOpened}
        onClose={closeManual}
        onSubmit={(blid) => {
          closeManual();
          onSubmit(blid);
        }}
      />
    </>
  );
}

function ManualBlidModal({
  opened,
  onClose,
  onSubmit,
}: {
  opened: boolean;
  onClose: () => void;
  onSubmit: (blid: string) => void;
}) {
  const [value, setValue] = useState("");
  const [showError, setShowError] = useState(false);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const blid = value.trim();
    if (!isValidBlid(blid)) {
      setShowError(true);
      return;
    }
    setValue("");
    setShowError(false);
    onSubmit(blid);
  }

  return (
    <Modal
      opened={opened}
      onClose={() => {
        setShowError(false);
        onClose();
      }}
      title="Skriv inn unik ID"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <BlidStickerHint scale={1.5} />
          <TextInput
            // Mantine's modal focus trap moves focus on open; data-autofocus points it here.
            data-autofocus
            label="Unik ID"
            description="8 eller 12 tegn"
            placeholder="12345678"
            value={value}
            error={showError ? "Unik ID må være 8 siffer eller 12 tegn" : undefined}
            onChange={(event) => {
              setValue(event.currentTarget.value);
              setShowError(false);
            }}
          />
          <Button type="submit">Søk opp bok</Button>
        </Stack>
      </form>
    </Modal>
  );
}
