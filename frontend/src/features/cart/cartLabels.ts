import type { CartItemOption, CartItemType } from "@boklisten/backend/shared/cart_item";

import { lineDate } from "@/features/cart-line/cartLineLabels";

const VERBS: Record<CartItemType, string> = {
  rent: "Lån til",
  "partly-payment": "Delbetaling til",
  buy: "Kjøp",
  extend: "Forleng til",
  buyout: "Kjøp ut",
};

/** What the pupil gets, in their words: "Lån til 1. juli 2027", "Kjøp", "Forleng til …". */
export function optionLabel(option: CartItemOption): string {
  const date = lineDate(option.to);
  return date ? `${VERBS[option.type]} ${date}` : VERBS[option.type];
}

export { signedKroner as kroner } from "@/features/cart-line/cartLineLabels";
