import type { Icon } from "@tabler/icons-react";
import { IconBooks, IconHeartHandshake, IconHistory, IconMailFast } from "@tabler/icons-react";

export const CUSTOMER_SEARCH_TABS = [
  "boker",
  "overleveringer",
  "meldinger",
  "ordrehistorikk",
] as const;
export type CustomerSearchTab = (typeof CUSTOMER_SEARCH_TABS)[number];

/** What each tab is called and its glyph, shared by the desktop tab row and the phone select. */
export const CUSTOMER_SEARCH_TAB_META: Record<CustomerSearchTab, { label: string; icon: Icon }> = {
  // Books to hand out and books the customer already has, in one list.
  boker: { label: "Bøker", icon: IconBooks },
  // The same glyph matches carry in the sidebar and the blid timeline.
  overleveringer: { label: "Overleveringer", icon: IconHeartHandshake },
  // The sidebar's Kommunikasjon glyph, so messages look the same in both places.
  meldinger: { label: "Meldinger", icon: IconMailFast },
  ordrehistorikk: { label: "Ordrehistorikk", icon: IconHistory },
};
