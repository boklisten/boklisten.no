import type { MessageChannel } from "@boklisten/backend/shared/message-log";
import {
  Badge,
  CloseButton,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import MessageEntryList from "@/features/message-log/MessageEntryList";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";

const POLL_INTERVAL_MS = 5000;
const FEED_LIMIT = 50;

export default function LiveFeed({
  sendoutFilter,
  onClearSendoutFilter,
}: {
  sendoutFilter: { id: number; name: string } | null;
  onClearSendoutFilter: () => void;
}) {
  const { api } = useApiClient();
  const [channel, setChannel] = useState<"alle" | MessageChannel>("alle");
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);

  const { data, isPending, error, errorUpdateCount } = useQuery(
    api.messageLogs.feed.queryOptions(
      {
        query: {
          limit: FEED_LIMIT,
          channel: channel === "alle" ? undefined : channel,
          sendoutId: sendoutFilter?.id,
          onlyFailures: onlyFailures || undefined,
          search: debouncedSearch === "" ? undefined : debouncedSearch,
        },
      },
      { refetchInterval: POLL_INTERVAL_MS, placeholderData: (previous) => previous },
    ),
  );

  return (
    <Stack gap={"sm"}>
      <Group gap={"sm"}>
        <SegmentedControl
          size={"xs"}
          value={channel}
          onChange={(value) => setChannel(value === "sms" || value === "email" ? value : "alle")}
          data={[
            { value: "alle", label: "Alle" },
            { value: "sms", label: "SMS" },
            { value: "email", label: "E-post" },
          ]}
        />
        <Switch
          size={"sm"}
          label={"Bare feil"}
          checked={onlyFailures}
          onChange={(event) => setOnlyFailures(event.currentTarget.checked)}
        />
        <TextInput
          size={"xs"}
          flex={1}
          miw={160}
          leftSection={<IconSearch size={14} />}
          placeholder={"Søk på telefonnummer eller e-post"}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
      </Group>
      {sendoutFilter && (
        <Group gap={4}>
          <Badge
            variant={"light"}
            rightSection={
              <CloseButton
                size={"xs"}
                aria-label={"Fjern utsendelsesfilter"}
                onClick={onClearSendoutFilter}
              />
            }
          >
            Utsendelse: {sendoutFilter.name}
          </Badge>
        </Group>
      )}
      {error && errorUpdateCount > 0 ? (
        <ErrorAlert>Kunne ikke hente meldingsloggen. Prøv igjen senere.</ErrorAlert>
      ) : isPending || !data ? (
        <Loader mx={"auto"} display={"block"} my={"lg"} />
      ) : (
        <>
          <MessageEntryList
            entries={data}
            withCustomerLink
            emptyText={
              onlyFailures ? "Ingen feilede meldinger. Alt ser bra ut!" : "Ingen meldinger ennå."
            }
          />
          {data.length === FEED_LIMIT && (
            <Text size={"xs"} c={"dimmed"} ta={"center"}>
              Viser de {FEED_LIMIT} nyeste meldingene. Bruk filtrene for å finne eldre.
            </Text>
          )}
        </>
      )}
    </Stack>
  );
}
