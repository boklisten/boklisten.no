import { Group, Modal, SegmentedControl, Stack, Text } from "@mantine/core";
import { IconScan } from "@tabler/icons-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { KASSE_ACCEPTS, KASSE_SCAN_TYPES, scanInstructionFor } from "@/features/kasse/kasseViews";
import type { KasseScanType } from "@/features/kasse/kasseViews";
import type { CodeHandler } from "@/features/kasse/useKasseScanner";
import StandCartLinkPanel from "@/features/stand-cart/StandCartLinkPanel";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import ScannerPanel from "@/shared/components/scanner/ScannerPanel";

/**
 * The Kasse's camera. Rendered by the page rather than through the modal manager so that a
 * question raised by a scan (a waiting batch, a waiting cart, a peer book) opens on top of it
 * without unmounting it. A segmented control under the instruction says what the employee is about
 * to scan and drives that instruction; it is preselected for the open view, and the camera reads
 * both codes whatever it says. Closing drops a link the camera had started, so the next open begins
 * with a clean sticker scan.
 */
export default function KasseScannerModal({
  opened,
  defaultType,
  onClose,
  onCode,
  cart,
  footer,
}: {
  opened: boolean;
  /** What the open view usually scans; selected every time the camera opens. */
  defaultType: KasseScanType;
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
        <KasseCamera defaultType={defaultType} onCode={onCode} footer={footer} />
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
  defaultType,
  onCode,
  footer,
}: {
  defaultType: KasseScanType;
  onCode: CodeHandler;
  footer: ReactNode | undefined;
}) {
  const [type, setType] = useState<KasseScanType>(defaultType);
  return (
    <Stack>
      <ScannerPanel
        // "Søk manuelt" on the page is the way in without a camera, so no typing of codes here
        allowManualEntry={false}
        accepts={KASSE_ACCEPTS}
        instruction={scanInstructionFor(type)}
        // In the dark strip with the instruction it drives, within thumb's reach on a phone
        instructionAddon={
          <SegmentedControl
            fullWidth
            size="sm"
            value={type}
            onChange={(value) =>
              setType(KASSE_SCAN_TYPES.find((entry) => entry.value === value)?.value ?? "blid")
            }
            data={KASSE_SCAN_TYPES}
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
