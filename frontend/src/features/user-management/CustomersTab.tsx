import { AreaChart, BarChart } from "@mantine/charts";
import { SimpleGrid, Skeleton, Stack } from "@mantine/core";
import {
  IconCalendarMonth,
  IconClock24,
  IconClockHour4,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import DuplicateCustomers from "@/features/user-management/DuplicateCustomers";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import ChartCard from "@/shared/components/charts/ChartCard";
import DonutWithLegend from "@/shared/components/charts/DonutWithLegend";
import StatTile from "@/shared/components/StatTile";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { norwegianTime } from "@/shared/utils/dayjs";

const METHOD_META = {
  vipps: { label: "Vipps", color: "orange.6" },
  local: { label: "Passord", color: "blue.6" },
  both: { label: "Vipps og passord", color: "teal.6" },
} as const;

const NEW_CUSTOMERS_MONTHS = 24;

function monthLabel(month: string) {
  return norwegianTime(`${month}-01`).format("MMM YYYY");
}

export default function CustomersTab() {
  const { api } = useApiClient();
  const { data: metrics, isPending, isError } = useQuery(api.userManagement.metrics.queryOptions());

  if (isError) {
    return (
      <ErrorAlert title={"Kunne ikke laste kundestatistikken"}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }
  if (isPending) {
    return (
      <Stack>
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height={100} radius={"md"} />
          ))}
        </SimpleGrid>
        <Skeleton height={280} radius={"md"} />
        <Skeleton height={280} radius={"md"} />
      </Stack>
    );
  }

  const growthData = metrics.registrationsByMonth.map((row) => ({
    month: monthLabel(row.month),
    Kunder: row.totalUsers,
  }));
  const newCustomersData = metrics.registrationsByMonth.slice(-NEW_CUSTOMERS_MONTHS).map((row) => ({
    month: monthLabel(row.month),
    "Nye kunder": row.newUsers,
  }));
  const loggedInCount =
    metrics.loginMethods.vipps + metrics.loginMethods.local + metrics.loginMethods.both;

  return (
    <Stack gap={"lg"}>
      <SimpleGrid cols={{ base: 2, sm: 3 }}>
        <StatTile
          label={"Kunder totalt"}
          value={metrics.totalUsers}
          icon={<IconUsers />}
          color={"blue"}
        />
        <StatTile
          label={"Nye siste 30 dager"}
          value={metrics.newLast30Days}
          icon={<IconUserPlus />}
          color={"teal"}
        />
        <StatTile
          label={"Nye siste år"}
          value={metrics.newLastYear}
          icon={<IconCalendarMonth />}
          color={"teal"}
        />
        <StatTile
          label={"Aktive siste døgn"}
          value={metrics.activeLast24Hours}
          icon={<IconClock24 />}
          color={"grape"}
        />
        <StatTile
          label={"Aktive siste 30 dager"}
          value={metrics.activeLast30Days}
          icon={<IconClockHour4 />}
          color={"grape"}
        />
        <StatTile
          label={"Aktive siste år"}
          value={metrics.activeLastYear}
          icon={<IconClockHour4 />}
          color={"grape"}
        />
      </SimpleGrid>
      <ChartCard
        title={"Kundevekst"}
        description={"Antall registrerte kunder over tid"}
        isEmpty={growthData.length === 0}
      >
        <AreaChart
          h={260}
          data={growthData}
          dataKey={"month"}
          series={[{ name: "Kunder", color: "blue.6" }]}
          curveType={"monotone"}
          withDots={false}
        />
      </ChartCard>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <ChartCard
          title={"Nye kunder per måned"}
          description={`Siste ${NEW_CUSTOMERS_MONTHS} måneder`}
          isEmpty={newCustomersData.length === 0}
        >
          <BarChart
            h={260}
            data={newCustomersData}
            dataKey={"month"}
            series={[{ name: "Nye kunder", color: "teal.6" }]}
          />
        </ChartCard>
        <ChartCard
          title={"Innloggingsmetode"}
          description={`Hvordan kundene logger inn. ${metrics.loginMethods.none.toLocaleString("nb-NO")} kunder har aldri logget inn.`}
          isEmpty={loggedInCount === 0}
        >
          <DonutWithLegend
            centerLabel={loggedInCount.toLocaleString("nb-NO")}
            data={(["vipps", "local", "both"] as const).map((method) => ({
              name: METHOD_META[method].label,
              value: metrics.loginMethods[method],
              color: METHOD_META[method].color,
            }))}
          />
        </ChartCard>
      </SimpleGrid>
      <DuplicateCustomers />
    </Stack>
  );
}
