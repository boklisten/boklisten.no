import { Group, Modal, Stack, Text } from "@mantine/core";
import { IconScan } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { KASSE_VIEW_CONFIG } from "@/features/kasse/kasseViews";
import type { KasseView } from "@/features/kasse/kasseViews";
import type { CodeHandler } from "@/features/kasse/useKasseScanner";
import StandCartLinkPanel from "@/features/stand-cart/StandCartLinkPanel";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import TypedScannerPanel from "@/shared/components/scanner/TypedScannerPanel";

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
 * The camera with its type picker, then the cart bar. Mounted afresh every time the modal opens,
 * so the picker starts on the open view's usual code without any state to reset.
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
  return (
    <Stack>
      <TypedScannerPanel
        // "Søk manuelt" on the page is the way in without a camera, so no typing of codes here
        allowManualEntry={false}
        types={scanTypes}
        defaultType={defaultScanType}
        onScan={(code) => onCode(code, "camera")}
      />
      {footer}
    </Stack>
  );
}
