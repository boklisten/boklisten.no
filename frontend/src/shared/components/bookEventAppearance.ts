import type { BlidHistoryAction } from "@boklisten/backend/shared/blid_search";
import type { StandCartActionType } from "@boklisten/backend/shared/stand_cart";
import type { Icon } from "@tabler/icons-react";
import {
  IconBookDownload,
  IconBookUpload,
  IconCalendarPlus,
  IconCalendarX,
  IconCoins,
  IconFileInvoice,
  IconHeartHandshake,
  IconShoppingCart,
  IconX,
} from "@tabler/icons-react";

export interface BookEventAppearance {
  icon: Icon;
  color: string;
}

/**
 * One look per thing that can happen to a book, shared by the Boksøk history and the cart's
 * actions, so an employee who has read a book's history recognises the same picture when they
 * are about to add the next entry to it.
 */
export const BOOK_EVENT_APPEARANCE: Record<BlidHistoryAction, BookEventAppearance> = {
  handout: { icon: IconBookUpload, color: "green" },
  return: { icon: IconBookDownload, color: "blue" },
  "match-transfer": { icon: IconHeartHandshake, color: "violet" },
  extend: { icon: IconCalendarPlus, color: "orange" },
  buyout: { icon: IconShoppingCart, color: "teal" },
  "invoice-paid": { icon: IconFileInvoice, color: "teal" },
  buyback: { icon: IconCoins, color: "pink" },
  cancel: { icon: IconX, color: "red" },
  "deadline-expired": { icon: IconCalendarX, color: "red" },
};

/** The history entry each cart action ends up as. */
const CART_ACTION_EVENT: Record<StandCartActionType, BlidHistoryAction> = {
  rent: "handout",
  "partly-payment": "handout",
  buy: "handout",
  sell: "buyback",
  cancel: "cancel",
  return: "return",
  buyback: "buyback",
  extend: "extend",
  buyout: "buyout",
};

export function cartActionAppearance(type: StandCartActionType): BookEventAppearance {
  return BOOK_EVENT_APPEARANCE[CART_ACTION_EVENT[type]];
}
