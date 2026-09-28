import { SimpleGrid, Skeleton, Text } from "@mantine/core";
import {
  IconBookDownload,
  IconBookUpload,
  IconBuildingStore,
  IconUsers,
} from "@tabler/icons-react";

import { usePlanMetrics } from "@/features/matches/rounds/usePlanMetrics";
import StatTile from "@/shared/components/StatTile";

const TILE_COLUMNS = { base: 1, sm: 2 };

function spreadOver(students: number): string {
  return `fordelt på ${students.toLocaleString("nb-NO")} ${students === 1 ? "elev" : "elever"}`;
}

export default function PlanMetrics({ roundId }: { roundId: string }) {
  const { data, isPending, isError } = usePlanMetrics(roundId);

  if (isError) {
    return (
      <Text size="sm" c="dimmed">
        Fikk ikke hentet tallene for planen. Dette påvirker ikke runden.
      </Text>
    );
  }

  if (isPending) {
    return (
      <SimpleGrid cols={TILE_COLUMNS}>
        {["elever", "leveres", "hentes", "stand"].map((tile) => (
          <Skeleton key={tile} height={104} radius="md" />
        ))}
      </SimpleGrid>
    );
  }

  return (
    <SimpleGrid cols={TILE_COLUMNS}>
      <StatTile
        label="Elever i filialene"
        value={data.branchMembers}
        caption="registrert på filialen og underfilialene"
        icon={<IconUsers />}
        color="blue"
      />
      <StatTile
        label="Bøker som skal leveres"
        value={data.activeBooks.books}
        caption={spreadOver(data.activeBooks.students)}
        icon={<IconBookDownload />}
        color="orange"
      />
      <StatTile
        label="Bøker som er bestilt"
        value={data.orderedBooks.books}
        caption={spreadOver(data.orderedBooks.students)}
        icon={<IconBookUpload />}
        color="teal"
      />
      <StatTile
        label="Bøker som går via stand"
        value={data.standOnlyBooks.books}
        caption={
          data.standOnlyBooks.books === 0
            ? "ingen regler sender bøker til standen"
            : `av disse, ${spreadOver(data.standOnlyBooks.students)}`
        }
        icon={<IconBuildingStore />}
        color="grape"
      />
    </SimpleGrid>
  );
}
