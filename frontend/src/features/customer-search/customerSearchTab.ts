export const CUSTOMER_SEARCH_TABS = [
  "bestillinger",
  "boker",
  "overleveringer",
  "meldinger",
  "ordrehistorikk",
] as const;
export type CustomerSearchTab = (typeof CUSTOMER_SEARCH_TABS)[number];
