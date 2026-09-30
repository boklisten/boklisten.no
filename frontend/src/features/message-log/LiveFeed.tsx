import type { MessageChannel } from "@boklisten/backend/shared/message-log";
import {
  Box,
  Center,
  Group,
  Loader,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue, useIntersection } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import MessageEntryList from "@/features/message-log/MessageEntryList";
import type { MessageLogSearchParams } from "@/features/message-log/messageLogParams";
import { TYPE_LABELS } from "@/features/message-log/meta";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { api } from "@/shared/utils/apiClient";
import { norwegianTime } from "@/shared/utils/dayjs";

const POLL_INTERVAL_MS = 5000;
const PAGE_SIZE = 50;
/** How many sendouts the filter offers; older ones are still reachable through a link. */
const SENDOUT_OPTIONS = 100;
/** The next page starts loading this far above the end, so scrolling rarely meets a spinner. */
const PREFETCH_MARGIN = "1500px";

type FeedFilters = Omit<MessageLogSearchParams, "loggFane">;

/** Picks the sendout the feed is narrowed to; the newest come first, searchable by name. */
function SendoutSelect({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (sendoutId: number | undefined) => void;
}) {
  const { data } = useQuery(
    api.messageLogs.sendouts.queryOptions({ query: { limit: SENDOUT_OPTIONS } }),
  );
  const options = (data ?? []).map((sendout) => ({
    value: String(sendout.id),
    label: `${sendout.name ?? TYPE_LABELS[sendout.kind]} · ${norwegianTime(sendout.createdAt).format("DD.MM.YYYY")}`,
  }));
  // A linked sendout may be older than the options offered; it still needs a name in the box.
  if (value !== undefined && !options.some((option) => option.value === String(value))) {
    options.push({ value: String(value), label: `Utsendelse #${value}` });
  }
  return (
    <Select
      size="xs"
      w={{ base: "100%", sm: 260 }}
      aria-label="Utsendelse"
      placeholder="Alle utsendelser"
      data={options}
      value={value === undefined ? null : String(value)}
      onChange={(selected) => onChange(selected === null ? undefined : Number(selected))}
      searchable
      clearable
      clearButtonProps={{ "aria-label": "Vis alle utsendelser" }}
      nothingFoundMessage="Ingen utsendelser passer"
    />
  );
}

/**
 * The global log, newest first, kept fresh by polling every loaded page. Older pages load as
 * the employee scrolls towards the end. The filters live in the URL, owned by the page.
 */
export default function LiveFeed({
  filters,
  onChange,
}: {
  filters: FeedFilters;
  onChange: (patch: Partial<FeedFilters>) => void;
}) {
  const [searchText, setSearchText] = useState(filters.loggSok ?? "");
  const [debouncedSearch] = useDebouncedValue(searchText.trim(), 300);
  useEffect(() => {
    if (debouncedSearch !== (filters.loggSok ?? "")) {
      onChange({ loggSok: debouncedSearch === "" ? undefined : debouncedSearch });
    }
  }, [debouncedSearch, filters.loggSok, onChange]);

  const {
    data,
    isPending,
    error,
    errorUpdateCount,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    ...api.messageLogs.feed.infiniteQueryOptions(
      {
        query: {
          limit: PAGE_SIZE,
          channel: filters.kanal,
          sendoutId: filters.utsendelse,
          onlyFailures: filters.bareFeil,
          search: filters.loggSok,
        },
      },
      {
        pageParamKey: "cursor",
        initialPageParam: "",
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
    refetchInterval: POLL_INTERVAL_MS,
    placeholderData: keepPreviousData,
  });

  const { ref: sentinelRef, entry } = useIntersection({ rootMargin: PREFETCH_MARGIN });
  const nearingEnd = entry?.isIntersecting ?? false;
  useEffect(() => {
    if (nearingEnd && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [nearingEnd, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const entries = data?.pages.flatMap((page) => page.entries) ?? [];
  const channel: "alle" | MessageChannel = filters.kanal ?? "alle";
  const narrowed =
    filters.kanal !== undefined ||
    filters.utsendelse !== undefined ||
    filters.loggSok !== undefined;

  return (
    <Stack gap="sm">
      <Group gap="sm">
        <SegmentedControl
          size="xs"
          value={channel}
          onChange={(value) =>
            onChange({ kanal: value === "sms" || value === "email" ? value : undefined })
          }
          data={[
            { value: "alle", label: "Alle" },
            { value: "sms", label: "SMS" },
            { value: "email", label: "E-post" },
          ]}
        />
        <SendoutSelect
          value={filters.utsendelse}
          onChange={(sendoutId) => onChange({ utsendelse: sendoutId })}
        />
        <Switch
          size="sm"
          label="Bare feil"
          checked={filters.bareFeil ?? false}
          onChange={(event) => onChange({ bareFeil: event.currentTarget.checked || undefined })}
        />
        <TextInput
          size="xs"
          flex={1}
          miw={160}
          leftSection={<IconSearch size={14} />}
          placeholder="Søk på telefonnummer eller e-post"
          value={searchText}
          onChange={(event) => setSearchText(event.currentTarget.value)}
        />
      </Group>
      {error && errorUpdateCount > 0 ? (
        <ErrorAlert>Kunne ikke hente meldingsloggen. Prøv igjen senere.</ErrorAlert>
      ) : isPending || !data ? (
        <Loader mx="auto" display="block" my="lg" />
      ) : (
        <>
          <MessageEntryList
            entries={entries}
            withCustomerLink
            emptyText={
              filters.bareFeil
                ? "Ingen feilede meldinger. Alt ser bra ut!"
                : narrowed
                  ? "Ingen meldinger passer filtrene."
                  : "Ingen meldinger ennå."
            }
          />
          <Box ref={sentinelRef} />
          {isFetchingNextPage && (
            <Center py="sm">
              <Loader size="sm" />
            </Center>
          )}
          {!hasNextPage && entries.length > 0 && (
            <Text size="xs" c="dimmed" ta="center" py="sm">
              Ingen flere meldinger
            </Text>
          )}
        </>
      )}
    </Stack>
  );
}
