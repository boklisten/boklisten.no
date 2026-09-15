import { STAND_CART_SCAN_TYPES } from "@/features/stand-cart/standCartScan";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import useWedgeScanner from "@/shared/hooks/useWedgeScanner";
import { showErrorNotification } from "@/shared/utils/notifications";

/**
 * The physical scanner while the order manager is open: every code goes to the selected order's
 * cart, which decides what it does with it. Without a selected order a scan has nowhere to go,
 * and says so.
 */
export default function useOrderWedgeScanner(cart: StandCart | null) {
  useWedgeScanner({
    accepts: cart === null ? STAND_CART_SCAN_TYPES : cart.scanTypes("wedge"),
    onScan: async (code) => {
      if (cart === null) {
        showErrorNotification("Velg en bestilling i listen før du skanner");
        return;
      }
      const notice = await cart.scan(code, "wedge");
      if (notice) {
        showErrorNotification({ title: notice.title, message: notice.message });
      }
    },
  });
}
