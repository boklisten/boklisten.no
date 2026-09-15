import StandCartLinkPanel from "@/features/stand-cart/StandCartLinkPanel";
import useStandCart from "@/features/stand-cart/useStandCart";
import TypedScannerPanel from "@/shared/components/scanner/TypedScannerPanel";

/**
 * What the «Skann bøker» modal shows. Normally just the camera reading books into the cart, with
 * the same type picker as the Kasse camera; the list of what to scan stays on the page behind it.
 * A sticker on no book yet hands over to the link panel. Reads the cart store live, since the
 * modal lives outside the page's tree.
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
    <TypedScannerPanel
      allowManualEntry
      types={cart.scanTypes("camera")}
      defaultType="blid"
      onScan={(code) => cart.scan(code, "camera")}
    />
  );
}
