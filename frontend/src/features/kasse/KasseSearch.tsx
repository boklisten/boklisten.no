import { createSpotlight } from "@mantine/spotlight";
import { useEffect } from "react";

import SearchSpotlight from "@/features/search/SearchSpotlight";
import { openSpotlight, registerSearchOverride } from "@/features/search/openSearch";

const [kasseSearchStore, kasseSearchSpotlight] = createSpotlight();

/**
 * The Kasse's own search: a customer or book pick is handed to the page's code router and so does
 * what a scan of the same code would do, instead of leaving for a fresh Kasse URL. Admin pages are
 * found as in the global search, so the shortcut still takes the employee anywhere. While mounted
 * it takes over the shortcuts and the search buttons.
 */
export default function KasseSearch({ onCode }: { onCode: (code: string) => void }) {
  useEffect(
    () =>
      registerSearchOverride(() => openSpotlight(kasseSearchSpotlight, { keyboard: "numeric" })),
    [],
  );
  return (
    <SearchSpotlight
      store={kasseSearchStore}
      kinds={{ customers: true, books: true, pages: true }}
      onSelectCustomer={onCode}
      onSelectBook={onCode}
    />
  );
}
