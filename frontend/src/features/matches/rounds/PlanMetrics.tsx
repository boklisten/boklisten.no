import { SimpleGrid, Skeleton, Text } from "@mantine/core";
import { IconBookDownload, IconBookUpload, IconUsers } from "@tabler/icons-react";

import { usePlanMetrics } from "@/features/matches/rounds/usePlanMetrics";
import StatTile from "@/shared/components/StatTile";

const TILE_COLUMNS = { base: 1, sm: 3 };

function spreadOver(students: number): string {
  return `fordelt på ${students.toLocaleString("nb-NO")} ${students === 1 ? "elev" : "elever"}`;
}

export default function PlanMetrics({ roundId }: { roundId: string }) {
  const { data, isPending, isError } = usePlanMetrics(roundId);

  if (isError) {
    return (
      <Text size={"sm"} c={"dimmed"}>
        Fikk ikke hentet tallene for planen. Dette påvirker ikke runden.
      </Text>
    );
  }

  if (isPending) {
    return (
      <SimpleGrid cols={TILE_COLUMNS}>
        {["elever", "leveres", "hentes"].map((tile) => (
          <Skeleton key={tile} height={104} radius={"md"} />
        ))}
      </SimpleGrid>
    );
  }

  return (
    <SimpleGrid cols={TILE_COLUMNS}>
      <StatTile
        label={"Elever i filialene"}
        value={data.branchMembers}
        caption={"antall registrerte elever på valgte filialer"}
        icon={<IconUsers />}
        color={"blue"}
      />
      <StatTile
        label={"Bøker som skal leveres"}
        value={data.activeBooks.books}
        caption={spreadOver(data.activeBooks.students)}
        icon={<IconBookDownload />}
        color={"orange"}
      />
      <StatTile
        label={"Bøker som er bestilt"}
        value={data.orderedBooks.books}
        caption={spreadOver(data.orderedBooks.students)}
        icon={<IconBookUpload />}
        color={"teal"}
      />
    </SimpleGrid>
  );
}
