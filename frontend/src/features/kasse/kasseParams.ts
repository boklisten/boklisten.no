import type { SearchSchemaInput } from "@tanstack/react-router";

import { isValidBlid } from "@/features/blid-search/validateBlid";
import { CUSTOMER_SEARCH_TABS } from "@/features/customer-search/customerSearchTab";
import type { CustomerSearchTab } from "@/features/customer-search/customerSearchTab";
import { KASSE_MODES } from "@/features/kasse/kasseModes";
import type { KasseMode } from "@/features/kasse/kasseModes";

/** What a link may pass. The mode is optional here; the page always sees a resolved one. */
export interface KasseSearchInput {
  modus?: KasseMode;
  /** Details id of the customer shown in Kunde mode. Kept in the URL while in the other modes. */
  kunde?: string;
  visning?: CustomerSearchTab;
  /** Unique ID of the book shown in Boksøk mode. Kept in the URL while in the other modes. */
  blid?: string;
}

export interface KasseSearchParams extends KasseSearchInput {
  modus: KasseMode;
}

export function validateKasseSearch(
  search: KasseSearchInput & SearchSchemaInput,
): KasseSearchParams {
  // Anything can be pasted into the URL, so trust nothing. A pasted ?blid=88375301 reaches us as
  // a number (TanStack parses search values as JSON).
  const untrusted: Partial<Record<keyof KasseSearchInput, unknown>> = search;
  const rawBlid =
    typeof untrusted["blid"] === "number" ? String(untrusted["blid"]) : untrusted["blid"];
  const blid = typeof rawBlid === "string" && isValidBlid(rawBlid) ? rawBlid : undefined;
  const kunde =
    typeof untrusted["kunde"] === "string" && untrusted["kunde"] !== ""
      ? untrusted["kunde"]
      : undefined;
  // Kunde is the default. Only links from outside the page omit the mode; the in-page updaters
  // below always write it, so clearing a result never flips the mode. Links from before Boksøk
  // was its own mode (bl-admin, bookmarks) carry only ?blid=.
  const modus =
    KASSE_MODES.find((mode) => mode === untrusted["modus"]) ??
    (blid !== undefined && kunde === undefined ? "boksok" : "kunde");
  return {
    modus,
    kunde,
    visning: CUSTOMER_SEARCH_TABS.find((tab) => tab === untrusted["visning"]),
    blid,
  };
}

/**
 * Search updaters for opening a customer or a book. They merge into the current search rather than
 * replace it, so the other modes keep their result and the employee can go back and forth.
 */
export const showCustomerSearch =
  (kunde: string) =>
  (previous: KasseSearchInput): KasseSearchParams => ({
    ...previous,
    modus: "kunde",
    kunde,
    visning: undefined,
  });

export const showBookSearch =
  (blid: string) =>
  (previous: KasseSearchInput): KasseSearchParams => ({ ...previous, modus: "boksok", blid });
