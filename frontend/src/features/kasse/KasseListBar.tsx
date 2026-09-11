import bookCountLabel from "@/features/bulk-collection/bookCountLabel";
import { useCollectionState } from "@/features/bulk-collection/collectionStore";
import { InnsamlingIcon } from "@/features/bulk-collection/innsamlingIcon";
import type { KasseView } from "@/features/kasse/kasseViews";
import StandCartBar from "@/features/stand-cart/StandCartBar";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import ListBar from "@/shared/components/ListBar";

/**
 * The one list with something in it, shown under the scan controls while a customer or a book is
 * open: the cart, which follows the employee from customer to customer until it is paid or given
 * up, or the Innsamling batch waiting behind them. Kasse never holds both, so the bar always says
 * one thing. The Innsamling is its own list, and the start screen holds none.
 */
export default function KasseListBar({
  view,
  cart,
  cartCustomerId,
  onOpenCart,
  onOpenInnsamling,
}: {
  view: KasseView;
  /** The cart that waits, whoever it belongs to. */
  cart: StandCart;
  cartCustomerId: string | null;
  onOpenCart: () => void;
  onOpenInnsamling: () => void;
}) {
  const { scannedBooks } = useCollectionState();

  // The start screen holds no list, and the Innsamling is its own list; neither shows a bar
  if (view !== "kunde" && view !== "blid") {
    return null;
  }
  if (!cart.isEmpty && cartCustomerId !== null) {
    return (
      <StandCartBar
        cart={cart}
        customer={{ detailsId: cartCustomerId, name: cart.cart.customerName }}
        onOpen={onOpenCart}
      />
    );
  }
  if (scannedBooks.length > 0) {
    return (
      <ListBar
        icon={<InnsamlingIcon size={20} aria-hidden />}
        label="Innsamling"
        heading={`${bookCountLabel(scannedBooks.length)} i innsamlingen`}
        action={{ full: "Fortsett innsamling", short: "Fortsett", onPress: onOpenInnsamling }}
      />
    );
  }
  return null;
}
