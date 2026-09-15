import { Group, Modal, SegmentedControl, Stack, Text } from "@mantine/core";
import { IconScan } from "@tabler/icons-react";
import { useState } from "react";
import type { ReactNode } from "react";

import {
  KASSE_VIEW_CONFIG,
  scanInstructionFor,
  scanTypePickerData,
} from "@/features/kasse/kasseViews";
import type { KasseView } from "@/features/kasse/kasseViews";
import type { CodeHandler } from "@/features/kasse/useKasseScanner";
import StandCartLinkPanel from "@/features/stand-cart/StandCartLinkPanel";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import ScannerPanel from "@/shared/components/scanner/ScannerPanel";

/**
 * The Kasse's camera. Rendered by the page rather than through the modal manager so that a
 * question raised by a scan (a waiting batch, a waiting cart, a peer book) opens on top of it
 * without unmounting it. A segmented control under the instruction says what the employee is about
 * to scan and drives that instruction; it is preselected for the open view, and the camera reads
 * every code of the view whatever it says. Closing drops a link the camera had started, so the
 * next open begins with a clean sticker scan.
 */
export default function KasseScannerModal({
  opened,
  view,
  onClose,
  onCode,
  cart,
  footer,
}: {
  opened: boolean;
  /** The open view: which codes the camera reads and which one is selected when it opens. */
  view: KasseView;
  onClose: () => void;
  onCode: CodeHandler;
  /** Under the manual entry: the cart bar while the cart has lines, so it is one tap away here too. */
  footer?: ReactNode;
  /** The open customer's cart, whose link step the camera finishes; null in the other views. */
  cart: StandCart | null;
}) {
  const linking = cart?.cart.linking?.via === "camera" ? cart.cart.linking : null;
  const close = () => {
    cart?.cancelLink("camera");
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={close}
      title={
        <Group gap="xs" wrap="nowrap">
          <IconScan size={20} aria-hidden />
          <Text fw={600}>Skanner</Text>
        </Group>
      }
    >
      {cart !== null && linking !== null ? (
        <StandCartLinkPanel cart={cart} linking={linking} />
      ) : (
        <KasseCamera view={view} onCode={onCode} footer={footer} />
      )}
    </Modal>
  );
}

/**
 * The camera, the instruction with its type picker, the manual entry, then the cart bar. Mounted
 * afresh every time the modal opens, so the picker starts on the open view's usual code without
 * any state to reset.
 */
function KasseCamera({
  view,
  onCode,
  footer,
}: {
  view: KasseView;
  onCode: CodeHandler;
  footer: ReactNode | undefined;
}) {
  const { scanTypes, defaultScanType } = KASSE_VIEW_CONFIG[view];
  const [type, setType] = useState(defaultScanType);
  return (
    <Stack>
      <ScannerPanel
        // "Søk manuelt" on the page is the way in without a camera, so no typing of codes here
        allowManualEntry={false}
        accepts={scanTypes}
        instruction={scanInstructionFor(type, scanTypes)}
        // In the dark strip with the instruction it drives, within thumb's reach on a phone
        instructionAddon={
          <SegmentedControl
            fullWidth
            size="sm"
            value={type}
            onChange={(value) =>
              setType(scanTypes.find((candidate) => candidate === value) ?? defaultScanType)
            }
            data={scanTypePickerData(scanTypes)}
            // On the scanner's dark ground; the separators between the unselected entries would
            // read as a stray white line, so the indicator alone marks the choice
            withItemsBorders={false}
            styles={{
              root: { background: "rgba(255, 255, 255, 0.1)" },
              indicator: { background: "rgba(255, 255, 255, 0.22)", boxShadow: "none" },
              label: { color: "#FFFFFF" },
            }}
          />
        }
        onScan={(code) => onCode(code, "camera")}
      />
      {footer}
    </Stack>
  );
}
