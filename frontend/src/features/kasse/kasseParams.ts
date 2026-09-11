import type { SearchSchemaInput } from "@tanstack/react-router";

import { isValidBlid } from "@/features/blid-search/validateBlid";
import { CUSTOMER_SEARCH_TABS } from "@/features/customer-search/customerSearchTab";
import type { CustomerSearchTab } from "@/features/customer-search/customerSearchTab";
import type { KasseView } from "@/features/kasse/kasseViews";

/**
 * The URL says which view is open and nothing else. The three view params are meant to be
 * mutually exclusive: the helpers below each write exactly one of them.
 */
export interface KasseSearchParams {
  /** Details id of the open customer. */
  kunde?: string;
  /** The open customer's tab; only meaningful with `kunde`. */
  visning?: CustomerSearchTab;
  /** Unique ID of the open book. */
  blid?: string;
  /** bl-admin deep-links to the Innsamling by it. */
  modus?: "innsamling";
}

/**
 * Anything can be pasted into the URL, so trust nothing: unknown or malformed values are dropped
 * (a pasted ?blid=88375301 reaches us as a number, since TanStack parses search values as JSON).
 * Several view params may survive here; `resolveKasseView` picks one, and the next in-page
 * navigation drops the rest.
 */
export function validateKasseSearch(
  search: KasseSearchParams & SearchSchemaInput,
): KasseSearchParams {
  const untrusted: Partial<Record<keyof KasseSearchParams, unknown>> = search;
  const rawBlid =
    typeof untrusted["blid"] === "number" ? String(untrusted["blid"]) : untrusted["blid"];
  return {
    kunde:
      typeof untrusted["kunde"] === "string" && untrusted["kunde"] !== ""
        ? untrusted["kunde"]
        : undefined,
    visning: CUSTOMER_SEARCH_TABS.find((tab) => tab === untrusted["visning"]),
    blid: typeof rawBlid === "string" && isValidBlid(rawBlid) ? rawBlid : undefined,
    modus: untrusted["modus"] === "innsamling" ? "innsamling" : undefined,
  };
}

/** Which view a URL opens. A hand-typed URL with several view params resolves by fixed precedence. */
export function resolveKasseView(search: KasseSearchParams): KasseView {
  if (search.kunde !== undefined) {
    return "kunde";
  }
  if (search.blid !== undefined) {
    return "blid";
  }
  if (search.modus === "innsamling") {
    return "innsamling";
  }
  return "empty";
}

/** The only three ways to write a Kasse URL; every link into the page uses one of them. */
export const showCustomer = (kunde: string): KasseSearchParams => ({ kunde });
export const showBlid = (blid: string): KasseSearchParams => ({ blid });
export const showInnsamling = (): KasseSearchParams => ({ modus: "innsamling" });
