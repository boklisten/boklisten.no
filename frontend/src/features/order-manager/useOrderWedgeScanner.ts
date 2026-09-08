import type { StandCart } from "@/features/stand-cart/useStandCart";
import useWedgeScanner from "@/shared/hooks/useWedgeScanner";
import { showErrorNotification } from "@/shared/utils/notifications";

async function submit(cart: StandCart, linking: boolean, code: string): Promise<void> {
  const notice = await (linking ? cart.proposeLink(code) : cart.addBlid(code, "wedge"));
  if (notice) {
    showErrorNotification({ title: notice.title, message: notice.message });
  }
}

/**
 * The physical scanner while the order manager is open: reads copies into the selected order's
 * cart, or the ISBN for a sticker that is on no book yet, the same way the Kasse does. Without a
 * selected order a scan has nowhere to go, and says so.
 */
export default function useOrderWedgeScanner(cart: StandCart | null) {
  const linking = cart?.cart.linking?.via === "wedge";
  useWedgeScanner({
    accepts: linking ? ["isbn"] : ["blid"],
    onScan: (code) => {
      if (cart === null) {
        showErrorNotification("Velg en bestilling i listen før du skanner");
        return;
      }
      void submit(cart, linking, code);
    },
  });
}
