import { ActionIcon, Group, Text, Tooltip } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

export default function DataFreshness({
  dataUpdatedAt,
  refreshIntervalMs,
  isFetching,
  onRefresh,
}: {
  dataUpdatedAt: number;
  refreshIntervalMs: number;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const secondsUntilNext = Math.max(0, Math.ceil((dataUpdatedAt + refreshIntervalMs - now) / 1000));

  return (
    <Group justify={"space-between"} wrap={"nowrap"}>
      <Group gap={"md"} wrap={"nowrap"}>
        <Text size={"sm"} c={"dimmed"}>
          Oppdatert kl. {dayjs(dataUpdatedAt).format("HH:mm:ss")}
        </Text>
        <Text size={"sm"} c={"dimmed"}>
          {isFetching ? "Oppdaterer …" : `Neste oppdatering om ${secondsUntilNext} sek`}
        </Text>
      </Group>
      <Tooltip label={"Oppdater nå"}>
        <ActionIcon
          variant={"light"}
          size={"lg"}
          loading={isFetching}
          onClick={onRefresh}
          aria-label={"Oppdater statistikk"}
        >
          <IconRefresh size={18} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
