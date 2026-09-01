import { BarChart } from "@mantine/charts";
import { FAILURE_MESSAGE_STATUSES } from "@boklisten/backend/shared/message-log";
import type {
  MessageChannel,
  MessageStatus,
  SendoutStatsDto,
} from "@boklisten/backend/shared/message-log";
import {
  Anchor,
  Badge,
  Group,
  Loader,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { CHANNEL_LABELS, TYPE_LABELS } from "@/features/message-log/meta";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import ChartCard from "@/shared/components/charts/ChartCard";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";

const REFRESH_INTERVAL_MS = 30_000;
const METRICS_DAYS = 30;

function sumStatuses(
  counts: Partial<Record<MessageStatus, number>>,
  statuses: readonly MessageStatus[],
) {
  return statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

const DELIVERED_OR_BETTER = ["delivered", "opened", "clicked"] as const;
const UNCONFIRMED = ["created", "sent", "skipped"] as const;

function ChannelFunnel({
  channel,
  counts,
}: {
  channel: MessageChannel;
  counts: Partial<Record<MessageStatus, number>>;
}) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const rows = [
    { label: "Levert", value: sumStatuses(counts, DELIVERED_OR_BETTER), color: "teal" },
    ...(channel === "email"
      ? [{ label: "Åpnet", value: sumStatuses(counts, ["opened", "clicked"]), color: "green" }]
      : []),
    { label: "Ubekreftet", value: sumStatuses(counts, UNCONFIRMED), color: "gray" },
    { label: "Feilet", value: sumStatuses(counts, FAILURE_MESSAGE_STATUSES), color: "red" },
  ];

  return (
    <Stack gap={6}>
      <Group gap={6}>
        <Text size="sm" fw={600}>
          {CHANNEL_LABELS[channel]}
        </Text>
        <Text size="xs" c="dimmed">
          {total.toLocaleString("nb-NO")} meldinger
        </Text>
      </Group>
      {total === 0 ? (
        <Text size="xs" c="dimmed" fs="italic">
          Ingen meldinger i perioden
        </Text>
      ) : (
        rows.map((row) => {
          const percent = Math.round((row.value / total) * 100);
          return (
            <Group key={row.label} gap="xs" wrap="nowrap">
              <Text size="xs" w={72}>
                {row.label}
              </Text>
              <Progress value={percent} color={row.color} flex={1} size="md" />
              <Text size="xs" c="dimmed" w={90} ta="right">
                {row.value.toLocaleString("nb-NO")} ({percent} %)
              </Text>
            </Group>
          );
        })
      )}
    </Stack>
  );
}

function SendoutRow({
  sendout,
  onShowInLog,
}: {
  sendout: SendoutStatsDto;
  onShowInLog: (sendout: SendoutStatsDto) => void;
}) {
  const failures = sumStatuses(sendout.statusCounts, FAILURE_MESSAGE_STATUSES);
  const delivered = sumStatuses(sendout.statusCounts, DELIVERED_OR_BETTER);
  return (
    <Paper withBorder p="sm" radius="md">
      <Group justify="space-between" gap="xs">
        <Stack gap={2} miw={0} flex={1}>
          <Group gap={6}>
            <Text size="sm" fw={600} truncate>
              {sendout.name ?? TYPE_LABELS[sendout.kind]}
            </Text>
            <Badge size="sm" variant="light" color="gray">
              {TYPE_LABELS[sendout.kind]}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {norwegianTime(sendout.createdAt).format("DD.MM.YYYY HH:mm")} ·{" "}
            {sendout.messageCount.toLocaleString("nb-NO")} meldinger ·{" "}
            {delivered.toLocaleString("nb-NO")} levert
          </Text>
        </Stack>
        <Group gap="xs">
          {failures > 0 && (
            <Badge color="red" variant="light">
              {failures} feil
            </Badge>
          )}
          <Anchor size="sm" component="button" onClick={() => onShowInLog(sendout)}>
            Vis i loggen
          </Anchor>
        </Group>
      </Group>
    </Paper>
  );
}

export default function MessageLogStatistics({
  onShowSendoutInLog,
}: {
  onShowSendoutInLog: (sendout: SendoutStatsDto) => void;
}) {
  const { api } = useApiClient();
  const metricsQuery = useQuery(
    api.messageLogs.metrics.queryOptions(
      { query: { days: METRICS_DAYS } },
      { refetchInterval: REFRESH_INTERVAL_MS },
    ),
  );
  const sendoutsQuery = useQuery(
    api.messageLogs.sendouts.queryOptions({}, { refetchInterval: REFRESH_INTERVAL_MS }),
  );

  if (metricsQuery.error && metricsQuery.errorUpdateCount > 0) {
    return <ErrorAlert>Kunne ikke hente statistikken. Prøv igjen senere.</ErrorAlert>;
  }
  const metrics = metricsQuery.data;
  if (!metrics) {
    return <Loader mx="auto" display="block" my="lg" />;
  }

  const volumeData = metrics.perDay.map((day) => ({
    date: norwegianTime(day.date).format("DD.MM"),
    SMS: day.sms,
    "E-post": day.email,
  }));
  const failureData = metrics.perDay.map((day) => ({
    date: norwegianTime(day.date).format("DD.MM"),
    Feil: day.failures,
  }));
  const totalInPeriod = metrics.perDay.reduce((sum, day) => sum + day.sms + day.email, 0);

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <ChartCard
          title="Meldinger per dag"
          description={`SMS og e-post siste ${METRICS_DAYS} dager`}
          isEmpty={totalInPeriod === 0}
        >
          <BarChart
            h={240}
            data={volumeData}
            dataKey="date"
            type="stacked"
            withLegend
            series={[
              { name: "SMS", color: "blue.6" },
              { name: "E-post", color: "grape.6" },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Feil per dag"
          description={`Meldinger som ikke kom frem siste ${METRICS_DAYS} dager`}
          isEmpty={metrics.perDay.every((day) => day.failures === 0)}
        >
          <BarChart
            h={240}
            data={failureData}
            dataKey="date"
            series={[{ name: "Feil", color: "red.6" }]}
          />
        </ChartCard>
      </SimpleGrid>
      <ChartCard
        title="Leveringsgrad"
        description={`Status for meldingene siste ${METRICS_DAYS} dager`}
        isEmpty={totalInPeriod === 0}
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
          <ChannelFunnel channel="sms" counts={metrics.funnel.sms} />
          <ChannelFunnel channel="email" counts={metrics.funnel.email} />
        </SimpleGrid>
      </ChartCard>
      <ChartCard
        title="Siste utsendelser"
        description="Påminnelser, utsendelser og varsler med leveringstall"
        isEmpty={(sendoutsQuery.data ?? []).length === 0}
      >
        <Stack gap="xs">
          {(sendoutsQuery.data ?? []).map((sendout) => (
            <SendoutRow key={sendout.id} sendout={sendout} onShowInLog={onShowSendoutInLog} />
          ))}
        </Stack>
      </ChartCard>
    </Stack>
  );
}
