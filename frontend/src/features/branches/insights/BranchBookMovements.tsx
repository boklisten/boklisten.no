import type { BranchBookMovementsYear } from "@boklisten/backend/shared/branch_insights";
import { BarChart, ChartTooltip } from "@mantine/charts";
import {
  Alert,
  Group,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  useComputedColorScheme,
} from "@mantine/core";
import type { Icon } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { TooltipContentProps } from "recharts";

import ChartCard from "@/shared/components/charts/ChartCard";
import { BOOK_EVENT_APPEARANCE } from "@/shared/components/bookEventAppearance";
import useApiClient from "@/shared/hooks/useApiClient";

interface MovementSeries {
  key: keyof Omit<BranchBookMovementsYear, "year">;
  label: string;
  icon: Icon;
  /** Mantine colour name, the one the same event has in the book history. */
  color: string;
}

/**
 * Segments in the order a book meets them: handed out, brought back, passed on, bought. Each
 * series borrows the look the same event has in the book history, so an employee who has read a
 * book's timeline recognises the segments without reading the legend twice. The one deviation is
 * the buyout: the history's teal sits too close to the handout green when both are filled
 * columns, so the chart uses the bluer cyan for it, in the legend as well as the segment.
 */
const SERIES: MovementSeries[] = [
  {
    key: "handedOut",
    label: "Utdelt",
    icon: BOOK_EVENT_APPEARANCE.handout.icon,
    color: BOOK_EVENT_APPEARANCE.handout.color,
  },
  {
    key: "collected",
    label: "Samlet inn",
    icon: BOOK_EVENT_APPEARANCE.return.icon,
    color: BOOK_EVENT_APPEARANCE.return.color,
  },
  {
    key: "transferred",
    label: "Overlevert fra elev til elev",
    icon: BOOK_EVENT_APPEARANCE["match-transfer"].icon,
    color: BOOK_EVENT_APPEARANCE["match-transfer"].color,
  },
  {
    key: "boughtOut",
    label: "Kjøpt ut",
    icon: BOOK_EVENT_APPEARANCE.buyout.icon,
    color: "cyan",
  },
];

/**
 * The series colour as a column fill. In light mode the name's main shade (6): the history's
 * own glyph shade reads too dark as a filled column and its tint too washed out. In dark mode
 * the exact glyph colour of the history's light-variant bullets, which is already a bright
 * shade. (Segment strokes are not an option: Mantine hides them with stroke-opacity 0.)
 */
function segmentColor(color: string, scheme: "light" | "dark"): string {
  return scheme === "light"
    ? `var(--mantine-color-${color}-6)`
    : `var(--mantine-color-${color}-light-color)`;
}

function chartSeries(scheme: "light" | "dark") {
  return SERIES.map((series) => ({
    name: series.label,
    color: segmentColor(series.color, scheme),
  }));
}

const numberFormat = new Intl.NumberFormat("nb-NO");
const percentFormat = new Intl.NumberFormat("nb-NO", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** "1 436 (42 %)": the count, then its share of the total it belongs to. */
function countWithShare(value: number, total: number): string {
  return total === 0
    ? numberFormat.format(value)
    : `${numberFormat.format(value)} (${percentFormat.format(value / total)})`;
}

/** Counts are the default reading; shares answer how the mix shifted between years. */
type View = "count" | "share";

/** The chart's own legend: the history's event bullets, each with its share across all years. */
function MovementLegend({ years }: { years: BranchBookMovementsYear[] }) {
  const totals = SERIES.map((series) => years.reduce((sum, year) => sum + year[series.key], 0));
  const grandTotal = totals.reduce((sum, total) => sum + total, 0);
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="md" verticalSpacing="xs">
      {SERIES.map((series, index) => (
        <Group key={series.key} gap={8} wrap="nowrap">
          <ThemeIcon variant="light" color={series.color} size={28} radius="xl">
            <series.icon size={16} aria-hidden />
          </ThemeIcon>
          <div>
            <Text size="sm" lh={1.2}>
              {series.label}
            </Text>
            <Text size="xs" c="dimmed" lh={1.2}>
              Totalt {countWithShare(totals[index] ?? 0, grandTotal)}
            </Text>
          </div>
        </Group>
      ))}
    </SimpleGrid>
  );
}

/** Both readings of a year at once: how many, and how big a share of that year's movements. */
function MovementTooltip({
  label,
  payload,
  series,
}: Pick<TooltipContentProps<number, string>, "label" | "payload"> & {
  series: ReturnType<typeof chartSeries>;
}) {
  // The hovered year's entries carry the raw counts even though the columns show shares.
  const total = payload.reduce(
    (sum, entry) => sum + (typeof entry.value === "number" ? entry.value : 0),
    0,
  );
  return (
    <ChartTooltip
      label={label}
      payload={payload}
      series={series}
      valueFormatter={(value) => countWithShare(value, total)}
    />
  );
}

export default function BranchBookMovements({ branchId }: { branchId: string }) {
  const { api } = useApiClient();
  const [view, setView] = useState<View>("count");
  const coloredSeries = chartSeries(useComputedColorScheme("light"));
  const { data, isLoading, isError } = useQuery(
    api.branchInsights.getBookMovements.queryOptions({ params: { branchId } }),
  );

  if (isError) {
    return (
      <Alert color="red" title="Klarte ikke hente bokbevegelsene">
        Prøv å laste siden på nytt.
      </Alert>
    );
  }
  if (isLoading || !data) {
    return (
      <Stack>
        <Skeleton h={25} w="40%" />
        <Skeleton h={16} w="70%" />
        <Skeleton h={320} />
      </Stack>
    );
  }

  const chartData = data.years.map((year) => ({
    year: String(year.year),
    ...Object.fromEntries(SERIES.map((series) => [series.label, year[series.key]])),
  }));

  return (
    <ChartCard
      title="Bokbevegelser per år"
      description="Bøker som er delt ut, samlet inn, overlevert og kjøpt ut ved filialen og underfilialene. Bøker som er solgt tilbake eller kansellert teller som samlet inn, og fakturerte bøker som kjøpt ut."
      action={
        <SegmentedControl
          size="xs"
          value={view}
          onChange={(value) => setView(value)}
          data={[
            { value: "count", label: "Antall" },
            { value: "share", label: "Andel" },
          ]}
          aria-label="Vis antall eller andel"
        />
      }
      isEmpty={data.years.length === 0}
    >
      <Stack gap="md">
        <MovementLegend years={data.years} />
        <BarChart
          h={320}
          data={chartData}
          dataKey="year"
          type={view === "share" ? "percent" : "stacked"}
          series={coloredSeries}
          maxBarWidth={40}
          valueFormatter={(value) => numberFormat.format(value)}
          // Norwegian percent ticks ("50 %") instead of the chart's built-in "50%".
          yAxisProps={
            view === "share"
              ? { tickFormatter: (value: number) => percentFormat.format(value) }
              : undefined
          }
          tooltipProps={{
            content: ({ label, payload }) => (
              <MovementTooltip label={label} payload={payload} series={coloredSeries} />
            ),
          }}
          tooltipAnimationDuration={150}
        />
      </Stack>
    </ChartCard>
  );
}
