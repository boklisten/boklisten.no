import type { CartItem, CartItemOption } from "@boklisten/backend/shared/cart_item";
import { ActionIcon } from "@mantine/core";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { useId } from "react";

import BookCoverArt from "@/features/book-cover/BookCoverArt";
import classes from "@/features/cart/cart.module.css";
import { kroner, optionLabel, payLaterLabel } from "@/features/cart/cartLabels";
import type { CartConflict } from "@/features/cart/useCartConflicts";

const REASONS: Record<CartConflict, string> = {
  owned: "Du har allerede denne boken. Den ligger under Dine bøker.",
  ordered: "Du har allerede bestilt denne boken. Bestillingen ligger under Dine bøker.",
};

/**
 * One book in the cart: its cover and title with the way out beside them, the ways to get it, and
 * the price of the chosen way while the cart has anything to pay. A book that cannot be ordered
 * keeps only its chosen way and the reason; removing it is the step.
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
  const id = useId();
  const later = payLaterLabel(selected);
  return (
    <li className={classes.line} data-conflict={conflict ?? undefined}>
      <span className={classes.cover} aria-hidden>
        <BookCoverArt title={cartItem.title} isbn={cartItem.isbn} />
      </span>
      <div className={classes.body}>
        <div className={classes.top}>
          <h2 className={classes.title} id={`${id}-title`}>
            {cartItem.title}
          </h2>
          <ActionIcon
            className={classes.remove}
            variant="subtle"
            color="gray"
            aria-label={`Fjern «${cartItem.title}» fra handlekurven`}
            onClick={onRemove}
          >
            <IconX size={18} aria-hidden />
          </ActionIcon>
        </div>

        {conflict && (
          <p className={classes.reason} role="status">
            <IconAlertTriangle size={18} aria-hidden />
            <span>{REASONS[conflict]}</span>
          </p>
        )}

        <div className={classes.foot}>
          {conflict !== null || cartItem.options.length === 1 ? (
            <p className={classes.single}>{optionLabel(selected)}</p>
          ) : (
            <fieldset className={classes.choices} aria-labelledby={`${id}-title`}>
              {cartItem.options.map((option, index) => (
                <label key={`${option.type}-${option.to ?? ""}`} className={classes.choice}>
                  <input
                    type="radio"
                    className={classes.choiceInput}
                    name={`${id}-option`}
                    checked={index === cartItem.selectedOptionIndex}
                    onChange={() => onSelect(index)}
                  />
                  <span className={classes.dot} aria-hidden />
                  <span className={classes.choiceText}>{optionLabel(option)}</span>
                </label>
              ))}
            </fieldset>
          )}
          {showPrice && (
            <div className={classes.price}>
              <span className={classes.priceNow}>{kroner(selected.price)}</span>
              {later && <span className={classes.priceLater}>+ {later}</span>}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
