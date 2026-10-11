import { Button, Stack } from "@mantine/core";

import RegistrationReceipt from "@/features/merking/RegistrationReceipt";
import ScannedBlidPanel from "@/features/merking/ScannedBlidPanel";
import type {
  BatchReceipt,
  ScannedBlidRow,
  SelectedBook,
} from "@/features/merking/registrationRows";
import ScanCodeIcon from "@/shared/components/scanner/ScanCodeIcon";
import ScanPrompt from "@/shared/components/scanner/ScanPrompt";

function ScanBlidsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      style={{ alignSelf: "center" }}
      leftSection={<ScanCodeIcon accepts={["blid"]} size={18} />}
      onClick={onClick}
    >
      Skann unike IDer
    </Button>
  );
}

/** Step two on the page: the panel with the camera button at the foot of its body. */
export default function ScannedBlidList({
  rows,
  book,
  receipt,
  onRemove,
  onDismissReceipt,
  onScan,
}: {
  rows: ScannedBlidRow[];
  book: SelectedBook | null;
  receipt: BatchReceipt | null;
  onRemove: (blid: string) => void;
  onDismissReceipt: () => void;
  /** Opens the camera for stickers. */
  onScan: () => void;
}) {
  return (
    <ScannedBlidPanel
      step={2}
      rows={rows}
      book={book}
      onRemove={onRemove}
      footer={
        <Stack px="md" pb="md" pt="xs">
          <ScanBlidsButton onClick={onScan} />
        </Stack>
      }
    >
      <Stack gap="md" flex={1} justify="center" p="md">
        {receipt === null ? (
          <ScanPrompt type="blid" py={0}>
            Skann unik ID på hver bok
          </ScanPrompt>
        ) : (
          <RegistrationReceipt receipt={receipt} onDismiss={onDismissReceipt} />
        )}
        <ScanBlidsButton onClick={onScan} />
      </Stack>
    </ScannedBlidPanel>
  );
}
