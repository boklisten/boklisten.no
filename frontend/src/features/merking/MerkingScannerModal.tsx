import { Group, Modal, Text } from "@mantine/core";
import { IconScan } from "@tabler/icons-react";

import ScannedBlidPanel from "@/features/merking/ScannedBlidPanel";
import type { ScannedBlidRow, SelectedBook } from "@/features/merking/registrationRows";
import ScannerPanel from "@/shared/components/scanner/ScannerPanel";
import type { ScannerPanelProps } from "@/shared/components/scanner/ScannerPanel";

/** Which of the page's two camera buttons opened the modal. */
export type MerkingScan = "isbn" | "blid";

const TITLES: Record<MerkingScan, string> = {
  isbn: "Skann ISBN",
  blid: "Skann unike IDer",
};

/**
 * The page's camera, in the page's own tree so the panel under it follows the session. An ISBN
 * scan closes the modal; the sticker scan stays open across the whole pile. Every code goes
 * through the session's `submitCode`, exactly as from the barcode reader.
 */
export default function MerkingScannerModal({
  scan,
  book,
  rows,
  onClose,
  onScan,
  onRemove,
}: {
  scan: MerkingScan | null;
  book: SelectedBook | null;
  rows: ScannedBlidRow[];
  onClose: () => void;
  onScan: ScannerPanelProps["onScan"];
  onRemove: (blid: string) => void;
}) {
  return (
    <Modal
      opened={scan !== null}
      onClose={onClose}
      title={
        <Group gap="xs" wrap="nowrap">
          <IconScan size={20} aria-hidden />
          <Text fw={600}>{scan === null ? "" : TITLES[scan]}</Text>
        </Group>
      }
    >
      {scan === "isbn" && (
        <ScannerPanel
          accepts={["isbn"]}
          instruction={{ text: "Bokas ISBN", illustrate: "isbn" }}
          onScan={onScan}
          onSuccess={onClose}
        />
      )}
      {scan === "blid" && (
        <ScannerPanel
          accepts={["blid"]}
          instruction={{ text: "Bokas unike ID", illustrate: "blid" }}
          onScan={onScan}
        >
          {rows.length > 0 && <ScannedBlidPanel rows={rows} book={book} onRemove={onRemove} />}
        </ScannerPanel>
      )}
    </Modal>
  );
}
