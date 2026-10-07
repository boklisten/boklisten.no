import { Skeleton, Text } from "@mantine/core";
import { IconBooks, IconPackageExport } from "@tabler/icons-react";
import type { ReactNode } from "react";

import classes from "@/features/book-list/BookList.module.css";
import BookListSection from "@/features/book-list/BookListSection";
import type { BookDetailsAudience } from "@/features/book-list/BookDetailsModal";

/** One part of the overview: its rows, and how many books they are (undefined while loading). */
export interface BookOverviewPart {
  count: number | undefined;
  content: ReactNode;
}

/** The two sections' headings, said to the customer about their own books or to the stand. */
const TITLES: Record<BookDetailsAudience, { ordered: string; held: string }> = {
  customer: { ordered: "Bestilte bøker", held: "Bøkene dine" },
  employee: { ordered: "Bestillinger", held: "Aktive bøker" },
};

function Body({ part, empty }: { part: BookOverviewPart; empty: string }) {
  if (part.count === undefined) {
    return <Skeleton height={120} radius="md" />;
  }
  if (part.count === 0) {
    return (
      <Text size="sm" c="dimmed">
        {empty}
      </Text>
    );
  }
  return part.content;
}

/**
 * A customer's books, the same on their own page and at the stand: what is ordered and what they
 * have, side by side on a wide screen and ordered first on a narrow one. A book that goes through
 * an overlevering sits with the others of its deadline; its row says whom it comes from or goes to.
 */
export default function BookOverview({
  audience,
  ordered,
  held,
  orderedFooter,
}: {
  audience: BookDetailsAudience;
  ordered: BookOverviewPart;
  held: BookOverviewPart;
  /** Under the ordered books, whatever their count: the customer's way to order more. */
  orderedFooter?: ReactNode;
}) {
  const titles = TITLES[audience];
  return (
    <div className={classes.overview}>
      <BookListSection title={titles.ordered} icon={IconPackageExport}>
        <Body part={ordered} empty="Ingen bestilte bøker" />
        {orderedFooter}
      </BookListSection>

      <BookListSection title={titles.held} icon={IconBooks}>
        <Body part={held} empty="Ingen aktive bøker" />
      </BookListSection>
    </div>
  );
}
