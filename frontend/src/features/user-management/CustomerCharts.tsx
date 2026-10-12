import { AreaChart, BarChart } from "@mantine/charts";
import { SimpleGrid, Skeleton, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import ChartCard from "@/shared/components/charts/ChartCard";
import DonutWithLegend from "@/shared/components/charts/DonutWithLegend";
import { api } from "@/shared/utils/apiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { norwegianTime } from "@/shared/utils/dayjs";

const METHOD_META = {
  vipps: { label: "Vipps", color: "orange.6" },
  sms: { label: "SMS", color: "blue.6" },
} as const;

const NEW_CUSTOMERS_MONTHS = 24;

function monthLabel(month: string) {
  return norwegianTime(`${month}-01`).format("MMM YYYY");
}

/** The customer charts of a node and the branches below it: growth, new per month and login method. */
export default function CustomerCharts({ branchId }: { branchId: string }) {
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
      <Stack>
        <Skeleton height={280} radius="md" />
        <Skeleton height={280} radius="md" />
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
  const loggedInCount = metrics.loginMethods.vipps + metrics.loginMethods.sms;

  return (
    <Stack gap="lg">
      <ChartCard
        title="Kundevekst"
        description="Antall registrerte kunder over tid"
        isEmpty={growthData.length === 0}
      >
        <AreaChart
          h={260}
          data={growthData}
          dataKey="month"
          series={[{ name: "Kunder", color: "blue.6" }]}
          curveType="monotone"
          withDots={false}
        />
      </ChartCard>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <ChartCard
          title="Nye kunder per måned"
          description={`Siste ${NEW_CUSTOMERS_MONTHS} måneder`}
          isEmpty={newCustomersData.length === 0}
        >
          <BarChart
            h={260}
            data={newCustomersData}
            dataKey="month"
            series={[{ name: "Nye kunder", color: "teal.6" }]}
          />
        </ChartCard>
        <ChartCard
          title="Innloggingsmetode"
          description={`Kunder som har koblet til Vipps, og kunder som bare har brukt SMS. ${metrics.loginMethods.none.toLocaleString("nb-NO")} kunder har aldri logget inn.`}
          isEmpty={loggedInCount === 0}
        >
          <DonutWithLegend
            centerLabel={loggedInCount.toLocaleString("nb-NO")}
            data={(["vipps", "sms"] as const).map((method) => ({
              name: METHOD_META[method].label,
              value: metrics.loginMethods[method],
              color: METHOD_META[method].color,
            }))}
          />
        </ChartCard>
      </SimpleGrid>
    </Stack>
  );
}
