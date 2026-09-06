import { createSpotlight } from "@mantine/spotlight";
import { useEffect } from "react";

import SearchSpotlight from "@/features/search/SearchSpotlight";
import { openSpotlight, registerSearchOverride } from "@/features/search/openSearch";

const [collectionSearchStore, collectionSearchSpotlight] = createSpotlight();

/**
 * Innsamling's own book search: a pick goes into the list instead of leaving for Boksøk. While
 * mounted it takes over the shortcuts and search buttons, so nothing pulls the employee out of a
 * half-scanned batch.
 */
export default function CollectionSearch({
  onSelectBook,
}: {
  onSelectBook: (blid: string) => void;
}) {
  useEffect(() => registerSearchOverride(() => openSpotlight(collectionSearchSpotlight)), []);
  return (
    <SearchSpotlight
      store={collectionSearchStore}
      kinds={{ customers: false, books: true }}
      onSelectBook={onSelectBook}
    />
  );
}
