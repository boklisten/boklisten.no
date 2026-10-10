import type { CartItem, CartItemOption } from "@boklisten/backend/shared/cart_item";

import CartLineCard from "@/features/cart-line/CartLineCard";
import type { CartLineChoice } from "@/features/cart-line/CartLineCard";
import { optionLabel } from "@/features/cart/cartLabels";
import type { CartConflict } from "@/features/cart/useCartConflicts";
import { cartActionAppearance } from "@/shared/components/bookEventAppearance";

const REASONS: Record<CartConflict, string> = {
  owned: "Du har allerede denne boken. Den ligger under Dine bøker.",
  ordered: "Du har allerede bestilt denne boken. Bestillingen ligger under Dine bøker.",
};

function toChoice(option: CartItemOption, index: number): CartLineChoice {
  return {
    key: String(index),
    label: optionLabel(option),
    // The same icon and colour the way has in Kasse and in a book's history
    appearance: cartActionAppearance(option.type),
  };
}

/**
 * One book in the public cart. A book that cannot be ordered keeps only its chosen way and the
 * reason; removing it is the step.
 */
export default function CartLine({
  cartItem,
  selected,
  conflict,
  showPrice,
  onSelect,
  onRemove,
}: {
  cartItem: CartItem;
  selected: CartItemOption;
  conflict: CartConflict | null;
  showPrice: boolean;
  onSelect: (optionIndex: number) => void;
  onRemove: () => void;
}) {
  return (
    <CartLineCard
      title={cartItem.title}
      isbn={cartItem.isbn}
      choices={cartItem.options.map(toChoice)}
      selectedKey={String(cartItem.selectedOptionIndex)}
      readOnly={conflict !== null}
      onSelect={(key) => onSelect(Number(key))}
      price={showPrice ? { now: selected.price, later: selected.payLater } : null}
      notice={conflict && REASONS[conflict]}
      warn={conflict !== null}
      onRemove={onRemove}
    />
  );
}
