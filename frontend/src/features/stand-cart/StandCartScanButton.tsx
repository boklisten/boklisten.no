import { Button } from "@mantine/core";
import { modals } from "@mantine/modals";

import StandCartScanner from "@/features/stand-cart/StandCartScanner";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import ScanCodeIcon from "@/shared/components/scanner/ScanCodeIcon";

const SCANNER_MODAL_ID = "stand-cart-scanner";

/** Closes the «Skann bøker» modal if it is open, for the cart bar that floats above it. */
export function closeStandCartScanner() {
  modals.close(SCANNER_MODAL_ID);
}

/**
 * The way books get into a customer's cart at the stand: the camera stays open while the employee
 * scans through the pile. Closing it drops a link the camera had started, so the next open begins
 * with a clean sticker scan.
 */
export default function StandCartScanButton({
  cart,
  customerId,
  orderId,
}: {
  cart: StandCart;
  customerId: string;
  /** Only copies on this order may enter the cart. */
  orderId?: string;
}) {
  const scan = () =>
    modals.open({
      modalId: SCANNER_MODAL_ID,
      title: "Skann bøker",
      children: <StandCartScanner customerId={customerId} orderId={orderId} />,
      onClose: () => cart.cancelLink("camera"),
    });

  return (
    <Button
      w={{ base: "100%", sm: "auto" }}
      style={{ alignSelf: "flex-start" }}
      leftSection={<ScanCodeIcon accepts={["blid"]} size={18} />}
      onClick={scan}
    >
      Skann bøker
    </Button>
  );
}
