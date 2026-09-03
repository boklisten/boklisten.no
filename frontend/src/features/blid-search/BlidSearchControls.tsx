import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconKeyboard, IconObjectScan } from "@tabler/icons-react";
import { useState } from "react";
import type { SubmitEvent } from "react";

import { isValidBlid } from "@/features/blid-search/validateBlid";
import openScannerModal from "@/shared/components/scanner/openScannerModal";
import useWedgeScanner from "@/shared/hooks/useWedgeScanner";

/**
 * The entry point for the public book lookup: scan with the camera, type an ID, or use a
 * physical barcode scanner at any time. Renders as a centered hero before the first search and as a
 * compact row once a result is showing, so the next book is always one scan away.
 */
export default function BlidSearchControls({
  onSubmit,
  compact,
  instruction,
}: {
  onSubmit: (blid: string) => void;
  compact: boolean;
  /** Dimmed hero text above the buttons. Omit when the page already explains the search. */
  instruction?: string;
}) {
  const [manualOpened, { open: openManual, close: closeManual }] = useDisclosure(false);
  useWedgeScanner({ accepts: ["blid"], onScan: onSubmit });

  const scanButton = (
    <Button
      size={compact ? "sm" : "lg"}
      radius="md"
      leftSection={<IconObjectScan size={compact ? 20 : 24} aria-hidden />}
      onClick={() =>
        openScannerModal({
          title: "Skann bøker",
          accepts: ["blid"],
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
          {instruction !== undefined && (
            <Text c="dimmed" ta="center">
              {instruction}
            </Text>
          )}
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
