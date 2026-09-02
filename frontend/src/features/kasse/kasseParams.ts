import { isValidBlid } from "@/features/blid-search/validateBlid";
import { CUSTOMER_SEARCH_TABS } from "@/features/customer-search/CustomerSearchTabs";
import type { CustomerSearchTab } from "@/features/customer-search/CustomerSearchTabs";
import type { KasseMode } from "@/features/kasse/KasseModeControl";

export interface KasseSearchParams {
  /** Details id of the customer being shown. Wins over blid when both are present. */
  kunde?: string;
  visning?: CustomerSearchTab;
  /** Unique ID of the book being shown. */
  blid?: string;
  /** Absent for the default Søk mode. */
  modus?: Exclude<KasseMode, "sok">;
}

export function validateKasseSearch(search: Record<string, unknown>): KasseSearchParams {
  // A pasted ?blid=88375301 reaches us as a number (TanStack parses search values as JSON).
  const rawBlid = typeof search["blid"] === "number" ? String(search["blid"]) : search["blid"];
  return {
    kunde:
      typeof search["kunde"] === "string" && search["kunde"] !== "" ? search["kunde"] : undefined,
    visning: CUSTOMER_SEARCH_TABS.find((tab) => tab === search["visning"]),
    blid: typeof rawBlid === "string" && isValidBlid(rawBlid) ? rawBlid : undefined,
    modus: search["modus"] === "innsamling" ? "innsamling" : undefined,
  };
}
