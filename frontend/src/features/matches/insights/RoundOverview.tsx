import type {
  MatchConfigDistributionEntry,
  StudentReachSummary,
} from "@boklisten/backend/shared/match/match-statistics";
import { SimpleGrid, Stack, useMatches } from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { IconBuildingStore, IconHeartHandshake, IconUsers } from "@tabler/icons-react";

import ChartCard from "@/shared/components/charts/ChartCard";
import DonutWithLegend from "@/shared/components/charts/DonutWithLegend";
import StatTile from "@/shared/components/StatTile";

// Coloured by how good the outcome is: only student handovers is best,
// student + stand is acceptable, stand only is the least desirable.
const CATEGORY_ORDER = ["userOnly", "both", "standOnly"] as const;
const CATEGORY_META = {
  userOnly: { label: "Kun elevoverlevering", color: "teal.6" },
  both: { label: "Elevoverlevering + stand", color: "yellow.6" },
  standOnly: { label: "Kun standoverlevering", color: "red.6" },
} as const;

/**
 * Only the one series a row belongs to has a value; the other stacked series
 * are undefined and must not print anything at the end of the bar.
 */
function formatBarValue(value: unknown) {
  return typeof value === "number" && value > 0 ? value.toLocaleString("nb-NO") : "";
}

export interface RoundOverviewProps {
  userMatchCount: number;
  standMatchCount: number;
  studentReach: StudentReachSummary;
  distribution: MatchConfigDistributionEntry[];
}

/** The first thing an administrator sees for a round: its size, and how many students the stand must serve. */
export default function RoundOverview({
  userMatchCount,
  standMatchCount,
  studentReach,
  distribution,
}: RoundOverviewProps) {
  // The longest row label is "2 elev- og 1 standoverlevering": one line on a laptop, two on a
  // phone, where the label column is kept narrow so the bars keep most of the width.
  const labelColumnWidth = useMatches({ base: 130, sm: 200 });
  const rowHeight = useMatches({ base: 48, sm: 32 });

  const distributionData = distribution.map((entry) => ({
    config: entry.label,
    [CATEGORY_META[entry.category].label]: entry.students,
  }));
  const distributionSeries = CATEGORY_ORDER.map((category) => ({
    name: CATEGORY_META[category].label,
    color: CATEGORY_META[category].color,
  }));

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <StatTile
          label="Antall elever"
          value={studentReach.totalStudents}
          icon={<IconUsers />}
          color="blue"
        />
        <StatTile
          label="Mellom elever"
          value={userMatchCount}
          icon={<IconHeartHandshake />}
          color="teal"
        />
        <StatTile
          label="På stand"
          value={standMatchCount}
          icon={<IconBuildingStore />}
          color="grape"
        />
      </SimpleGrid>

      <ChartCard title="Hvor mange må innom stand?">
        <DonutWithLegend
          centerLabel={studentReach.totalStudents.toLocaleString("nb-NO")}
          data={[
            {
              name: CATEGORY_META.userOnly.label,
              value: studentReach.onlyUserHandovers,
              color: "teal.6",
            },
            { name: "Må møte på stand", value: studentReach.mustVisitStand, color: "grape.6" },
          ]}
        />
      </ChartCard>

      <ChartCard
        title="Fordeling av overleveringer per elev"
        description="Antall elever per kombinasjon av overleveringer, fargelagt etter hvor gunstig løsningen er"
        isEmpty={distributionData.length === 0}
      >
        <BarChart
          h={Math.max(300, distributionData.length * rowHeight)}
          data={distributionData}
          dataKey="config"
          type="stacked"
          orientation="vertical"
          yAxisProps={{ width: labelColumnWidth }}
          series={distributionSeries}
          withLegend
          withXAxis={false}
          gridAxis="none"
          withBarValueLabel
          valueLabelProps={{ formatter: formatBarValue }}
        />
      </ChartCard>
    </Stack>
  );
}
