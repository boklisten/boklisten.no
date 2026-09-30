import type { CartItemOption, CartItemType } from "@boklisten/backend/shared/cart_item";

import { formatDeadline } from "@/shared/utils/deadline";

const VERBS: Record<CartItemType, string> = {
  rent: "Lån til",
  "partly-payment": "Delbetaling til",
  buy: "Kjøp",
  extend: "Forleng til",
  buyout: "Kjøp ut",
};

/** What the pupil gets, in their words: "Lån til 1. juli 2027", "Kjøp", "Forleng til …". */
export function optionLabel(option: CartItemOption): string {
  const verb = VERBS[option.type];
  return option.to ? `${verb} ${formatDeadline(option.to, "D. MMMM YYYY")}` : verb;
}

export function kroner(amount: number): string {
  return `${Math.ceil(amount).toLocaleString("nb-NO")} kr`;
}

/** The rest of the price, paid later, for a delbetaling option; null for the others. */
export function payLaterLabel(option: CartItemOption): string | null {
  return option.payLater ? `${kroner(option.payLater)} senere` : null;
}
