import { SimpleGrid, Skeleton } from "@mantine/core";
import { IconCalendarMonth, IconClock24, IconClockHour4, IconUserPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import StatTile from "@/shared/components/StatTile";
import { api } from "@/shared/utils/apiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

const COLS = { base: 2, sm: 3, lg: 5 };

/** How many of a node's members are new and how many are active, as one row of tiles on Innsikt. */
export default function CustomerStatTiles({ branchId }: { branchId: string }) {
  const {
    data: metrics,
    isPending,
    isError,
  } = useQuery(api.users.metrics.queryOptions({ query: { branchId } }));

  if (isError) {
    return (
      <ErrorAlert title="Kunne ikke laste kundestatistikken">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }
  if (isPending) {
    return (
      <SimpleGrid cols={COLS}>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} height={100} radius="md" />
        ))}
      </SimpleGrid>
    );
  }
  return (
    <SimpleGrid cols={COLS}>
      <StatTile
        label="Nye siste 30 dager"
        value={metrics.newLast30Days}
        icon={<IconUserPlus />}
        color="teal"
      />
      <StatTile
        label="Nye siste år"
        value={metrics.newLastYear}
        icon={<IconCalendarMonth />}
        color="teal"
      />
      <StatTile
        label="Aktive siste døgn"
        value={metrics.activeLast24Hours}
        icon={<IconClock24 />}
        color="indigo"
      />
      <StatTile
        label="Aktive siste 30 dager"
        value={metrics.activeLast30Days}
        icon={<IconClockHour4 />}
        color="indigo"
      />
      <StatTile
        label="Aktive siste år"
        value={metrics.activeLastYear}
        icon={<IconClockHour4 />}
        color="indigo"
      />
    </SimpleGrid>
  );
}
