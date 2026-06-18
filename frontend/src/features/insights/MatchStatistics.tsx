import { Button, Group, Progress, SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";
import { BarChart } from "@mantine/charts";
import {
  IconArrowsExchange,
  IconBuildingStore,
  IconDownload,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import ChartCard from "@/features/insights/ChartCard";
import DataFreshness from "@/features/insights/DataFreshness";
import DonutWithLegend from "@/features/insights/DonutWithLegend";
import StatTile from "@/features/insights/StatTile";
import SunburstChart from "@/features/insights/SunburstChart";
import useReportDownload from "@/features/reports/useReportDownload";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

const REFRESH_INTERVAL_MS = 30_000;

// Coloured by how good the outcome is: only student handovers is best,
// student + stand is acceptable, stand only is the least desirable.
const CATEGORY_ORDER = ["userOnly", "both", "standOnly"] as const;
const CATEGORY_META = {
  userOnly: { label: "Kun elevoverlevering", color: "teal.6" },
  both: { label: "Elevoverlevering + stand", color: "yellow.6" },
  standOnly: { label: "Kun standoverlevering", color: "red.6" },
} as const;

const LOCATION_PALETTE = [
  "blue.6",
  "teal.6",
  "grape.6",
  "orange.6",
  "cyan.6",
  "pink.6",
  "lime.7",
  "indigo.6",
  "yellow.7",
  "red.6",
];

function percent(part: number, whole: number) {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

function slotLabel(date: string | null) {
  return date ? dayjs(date).format("DD.MM HH:mm") : "Uten tidspunkt";
}

function compareSlots(a: string | null, b: string | null) {
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

export default function MatchStatistics() {
  const { api } = useApiClient();
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } = useQuery(
    api.matchStatistics.getStatistics.queryOptions(
      {},
      {
        refetchInterval: REFRESH_INTERVAL_MS,
      },
    ),
  );
  const pickupListDownload = useReportDownload({
    fetchRows: () =>
      Promise.resolve(
        (data?.standBookExpectations ?? [])
          .filter((book) => book.expectedOut > 0)
          .map((book) => ({
            Tittel: book.title,
            Forventet: book.expectedOut,
            Hentet: book.actualOut,
            Gjenstår: Math.max(0, book.expectedOut - book.actualOut),
          })),
      ),
    filename: "plukkliste-stand.csv",
    errorMessage: "Klarte ikke å laste ned plukklisten",
  });

  if (isLoading) {
    return (
      <Stack>
        <Skeleton height={40} />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Skeleton height={90} />
          <Skeleton height={90} />
          <Skeleton height={90} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Skeleton height={300} />
          <Skeleton height={300} />
        </SimpleGrid>
      </Stack>
    );
  }

  if (isError || !data) {
    return <ErrorAlert title={"Kunne ikke laste statistikken"}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }

  const { studentReach } = data;

  const userCompletionDonut = [
    { name: "Fullført", value: data.userMatchCompletion.completed, color: "teal.6" },
    { name: "Påbegynt", value: data.userMatchCompletion.started, color: "yellow.6" },
    { name: "Ikke startet", value: data.userMatchCompletion.notStarted, color: "gray.5" },
  ];
  const standCompletionDonut = [
    { name: "Fullført", value: data.standMatchCompletion.completed, color: "teal.6" },
    { name: "Påbegynt", value: data.standMatchCompletion.started, color: "yellow.6" },
    { name: "Ikke startet", value: data.standMatchCompletion.notStarted, color: "gray.5" },
  ];
  const userCompletedPercent = percent(data.userMatchCompletion.completed, data.userMatchCount);
  const standCompletedPercent = percent(data.standMatchCompletion.completed, data.standMatchCount);

  const bookTransfer = [
    { label: "Elevoverlevering", ...data.userBookTransfer },
    { label: "Inn til standen", ...data.standBooksIn },
    { label: "Ut fra standen", ...data.standBooksOut },
  ];
  const bookTransferData = bookTransfer.map(({ label, expected, transferred }) => ({
    type: label,
    Forventet: expected,
    Overført: transferred,
  }));

  const distributionData = data.distribution.map((entry) => ({
    config: entry.label,
    [CATEGORY_META[entry.category].label]: entry.students,
  }));
  const distributionSeries = CATEGORY_ORDER.map((category) => ({
    name: CATEGORY_META[category].label,
    color: CATEGORY_META[category].color,
  }));

  const booksOutData = [...data.standBookExpectations]
    .filter((book) => book.expectedOut > 0 || book.actualOut > 0)
    .sort((a, b) => b.expectedOut - a.expectedOut)
    .map((book) => ({ title: book.title, Forventet: book.expectedOut, Hentet: book.actualOut }));
  const booksInData = [...data.standBookExpectations]
    .filter((book) => book.expectedIn > 0 || book.actualIn > 0)
    .sort((a, b) => b.expectedIn - a.expectedIn)
    .map((book) => ({ title: book.title, Forventet: book.expectedIn, Levert: book.actualIn }));

  const standAttendanceData = data.standAttendance.map((slot) => ({
    slot: slotLabel(slot.date),
    Elever: slot.people,
  }));

  const attendanceLocations = [...new Set(data.userAttendance.map((slot) => slot.location))].sort(
    (a, b) => a.localeCompare(b),
  );
  const attendanceDates = [...new Set(data.userAttendance.map((slot) => slot.date))].sort(
    compareSlots,
  );
  // Pivot the flat (location, date, people) list into one row per time slot,
  // with a column per location, for the stacked bar chart.
  const rowByDate = new Map<string | null, Record<string, number | string>>(
    attendanceDates.map((date) => [
      date,
      { slot: slotLabel(date), ...Object.fromEntries(attendanceLocations.map((loc) => [loc, 0])) },
    ]),
  );
  for (const slot of data.userAttendance) {
    rowByDate.get(slot.date)![slot.location] = slot.people;
  }
  const userAttendanceData = attendanceDates.map((date) => rowByDate.get(date)!);
  const attendanceSeries = attendanceLocations.map((location, index) => ({
    name: location,
    color: LOCATION_PALETTE[index % LOCATION_PALETTE.length] ?? "blue.6",
  }));

  return (
    <Stack gap={"lg"}>
      <DataFreshness
        dataUpdatedAt={dataUpdatedAt}
        refreshIntervalMs={REFRESH_INTERVAL_MS}
        isFetching={isFetching}
        onRefresh={() => refetch()}
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <StatTile
          label={"Antall elever"}
          value={studentReach.totalStudents}
          icon={<IconUsers />}
          color={"blue"}
        />
        <StatTile
          label={"Elevoverleveringer"}
          value={data.userMatchCount}
          icon={<IconArrowsExchange />}
          color={"teal"}
        />
        <StatTile
          label={"Standoverleveringer"}
          value={data.standMatchCount}
          icon={<IconBuildingStore />}
          color={"grape"}
        />
      </SimpleGrid>

      <ChartCard title={"Hvor mange må innom stand?"}>
        <DonutWithLegend
          centerLabel={studentReach.totalStudents.toLocaleString("nb-NO")}
          data={[
            {
              name: "Kun elevoverlevering",
              value: studentReach.onlyUserHandovers,
              color: "teal.6",
            },
            { name: "Må møte på stand", value: studentReach.mustVisitStand, color: "grape.6" },
          ]}
        />
      </ChartCard>

      <ChartCard
        title={"Fordeling av overleveringer per elev"}
        description={
          "Antall elever per kombinasjon av overleveringer, fargelagt etter hvor gunstig løsningen er"
        }
        isEmpty={distributionData.length === 0}
      >
        <BarChart
          h={Math.max(300, distributionData.length * 32)}
          data={distributionData}
          dataKey={"config"}
          type={"stacked"}
          orientation={"vertical"}
          yAxisProps={{ width: 210 }}
          series={distributionSeries}
          withLegend
        />
      </ChartCard>

      <ChartCard
        title={"Fullføringsgrad"}
        description={
          "Hvor stor andel av overleveringene som er fullført, påbegynt eller ikke startet"
        }
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Stack gap={"xs"}>
            <Text fw={600}>Elevoverleveringer</Text>
            <DonutWithLegend centerLabel={`${userCompletedPercent} %`} data={userCompletionDonut} />
          </Stack>
          <Stack gap={"xs"}>
            <Text fw={600}>Standoverleveringer</Text>
            <DonutWithLegend
              centerLabel={`${standCompletedPercent} %`}
              data={standCompletionDonut}
            />
          </Stack>
        </SimpleGrid>
      </ChartCard>

      <ChartCard title={"Bokoverføringer"} description={"Forventet mot faktisk overførte bøker"}>
        <Stack>
          <BarChart
            h={300}
            data={bookTransferData}
            dataKey={"type"}
            series={[
              { name: "Forventet", color: "blue.3" },
              { name: "Overført", color: "teal.6" },
            ]}
            withLegend
          />
          <Stack gap={4}>
            {bookTransfer.map(({ label, expected, transferred }) => (
              <div key={label}>
                <Group justify={"space-between"}>
                  <Text size={"sm"}>{label}</Text>
                  <Text size={"sm"} c={"dimmed"}>
                    {transferred} / {expected} ({percent(transferred, expected)} %)
                  </Text>
                </Group>
                <Progress value={percent(transferred, expected)} color={"teal"} />
              </div>
            ))}
          </Stack>
        </Stack>
      </ChartCard>

      <ChartCard
        title={"Bøker ut fra standen"}
        description={"Forventet mot faktisk uthentede eksemplarer per tittel"}
        isEmpty={booksOutData.length === 0}
      >
        <Stack>
          <Group justify={"flex-end"}>
            <Button
              variant={"light"}
              leftSection={<IconDownload size={16} />}
              loading={pickupListDownload.isLoading}
              onClick={pickupListDownload.download}
            >
              Last ned plukkliste (CSV)
            </Button>
          </Group>
          <BarChart
            h={Math.max(300, booksOutData.length * 30)}
            data={booksOutData}
            dataKey={"title"}
            orientation={"vertical"}
            yAxisProps={{ width: 240 }}
            series={[
              { name: "Forventet", color: "blue.3" },
              { name: "Hentet", color: "blue.7" },
            ]}
            withLegend
          />
        </Stack>
      </ChartCard>

      <ChartCard
        title={"Bøker inn til standen"}
        description={"Forventet mot faktisk innleverte eksemplarer per tittel"}
        isEmpty={booksInData.length === 0}
      >
        <BarChart
          h={Math.max(300, booksInData.length * 30)}
          data={booksInData}
          dataKey={"title"}
          orientation={"vertical"}
          yAxisProps={{ width: 240 }}
          series={[
            { name: "Forventet", color: "orange.3" },
            { name: "Levert", color: "orange.7" },
          ]}
          withLegend
        />
      </ChartCard>

      <ChartCard
        title={"Oppmøte per lokasjon og tidspunkt"}
        description={
          "Antall elever som forventes til elevoverlevering, fordelt på sted og tidspunkt"
        }
        isEmpty={userAttendanceData.length === 0}
      >
        <BarChart
          h={350}
          data={userAttendanceData}
          dataKey={"slot"}
          type={"stacked"}
          series={attendanceSeries}
          withLegend
        />
      </ChartCard>

      <ChartCard
        title={"Oppmøte på stand per tidspunkt"}
        description={"Antall elever som forventes på standen per møtetidspunkt"}
        isEmpty={standAttendanceData.length === 0}
      >
        <BarChart
          h={300}
          data={standAttendanceData}
          dataKey={"slot"}
          series={[{ name: "Elever", color: "grape.6" }]}
        />
      </ChartCard>

      <ChartCard
        title={"Filialtilknytning for elever på stand"}
        description={"Hvilke filialer elevene som må møte på standen hører til"}
        isEmpty={data.standBranchHierarchy.length === 0}
      >
        <SunburstChart data={data.standBranchHierarchy} />
      </ChartCard>
    </Stack>
  );
}
