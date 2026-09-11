import StandCartLinkPanel from "@/features/stand-cart/StandCartLinkPanel";
import useStandCart from "@/features/stand-cart/useStandCart";
import ScannerPanel from "@/shared/components/scanner/ScannerPanel";

/**
 * What the «Skann bøker» modal shows. Normally just the camera reading stickers into the cart; the
 * list of what to scan stays on the page behind it. A sticker on no book yet hands over to the
 * link panel. Reads the cart store live, since the modal lives outside the page's tree.
 */
export default function StandCartScanner({
  customerId,
  orderId,
}: {
  customerId: string;
  /** Only copies on this order may enter the cart. */
  orderId?: string;
}) {
  const cart = useStandCart(customerId, orderId === undefined ? undefined : { orderId });
  const linking = cart.cart.linking?.via === "camera" ? cart.cart.linking : null;

  if (linking !== null) {
    return <StandCartLinkPanel cart={cart} linking={linking} />;
  }
  return (
    <ScannerPanel
      allowManualEntry
      accepts={["blid"]}
      instruction={{ text: "Bokas unike ID", illustrate: "blid" }}
      onScan={(blid) => cart.addBlid(blid, "camera")}
    />
  );
}
