import type {
  AdminStandMatchWithDetails,
  UserMatchWithDetails,
} from "@boklisten/backend/shared/match/match-dtos";
import {
  Card,
  Group,
  Input,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconArrowsExchange,
  IconCircleCheck,
  IconInbox,
  IconProgress,
  IconSearch,
  IconSearchOff,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import AdminStandMatchListItem from "@/features/matches/adminOverview/AdminStandMatchListItem";
import AdminUserMatchListItem from "@/features/matches/adminOverview/AdminUserMatchListItem";
import useAllMatches from "@/features/matches/adminOverview/useAllMatches";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import {
  isStandMatchFulfilled,
  isUserMatchFullyFulfilled,
} from "@/shared/components/matches/matches-helper";
import StatTile from "@/shared/components/StatTile";

type MatchTypeFilter = "both" | "user" | "stand";
type MatchRow = UserMatchWithDetails | AdminStandMatchWithDetails;

const ROW_CAP = 200;

function isStandRow(match: MatchRow): match is AdminStandMatchWithDetails {
  return "customer" in match;
}

function isRowFulfilled(match: MatchRow): boolean {
  return isStandRow(match) ? isStandMatchFulfilled(match) : isUserMatchFullyFulfilled(match);
}

function rowMatchesSearch(match: MatchRow, needle: string): boolean {
  const details = isStandRow(match)
    ? [match.customerDetails]
    : [match.customerADetails, match.customerBDetails];
  return details
    .flatMap((detail) => [detail.name, detail.phone, detail.email])
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function MatchRowItem({ match }: { match: MatchRow }) {
  return isStandRow(match) ? (
    <AdminStandMatchListItem standMatch={match} />
  ) : (
    <AdminUserMatchListItem userMatch={match} />
  );
}

function OverviewEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <Card withBorder radius={"md"} padding={"xl"}>
      <Stack align={"center"} gap={"sm"} py={"xl"}>
        <ThemeIcon size={56} radius={"xl"} variant={"light"} color={filtered ? "blue" : "gray"}>
          {filtered ? <IconSearchOff size={30} /> : <IconInbox size={30} />}
        </ThemeIcon>
        <Title order={3}>{filtered ? "Ingen treff" : "Ingen overleveringer enda"}</Title>
        <Text c={"dimmed"} ta={"center"} maw={440}>
          {filtered
            ? "Ingen overleveringer passer søket eller filteret. Prøv et annet navn, telefonnummer eller e-post — eller sett filteret til Begge."
            : "Når overleveringer genereres, dukker de opp her."}
        </Text>
      </Stack>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <Stack gap={"lg"}>
      <Group align={"flex-end"} gap={"md"} wrap={"wrap"}>
        <Skeleton height={36} style={{ flex: 1, minWidth: 220 }} />
        <Skeleton height={36} width={232} />
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Skeleton height={88} />
        <Skeleton height={88} />
        <Skeleton height={88} />
      </SimpleGrid>
      <Stack>
        <Skeleton height={128} />
        <Skeleton height={128} />
        <Skeleton height={128} />
      </Stack>
    </Stack>
  );
}

function MatchGroup({ heading, matches }: { heading: string; matches: MatchRow[] }) {
  if (matches.length === 0) return null;
  return (
    <Stack>
      <Title order={2}>{heading}</Title>
      {matches.map((match) => (
        <MatchRowItem key={match.id} match={match} />
      ))}
    </Stack>
  );
}

export default function AdminMatchOverview() {
  const { data, error, isLoading } = useAllMatches();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MatchTypeFilter>("both");

  const needle = search.trim().toLowerCase();

  const rows = useMemo<MatchRow[]>(() => {
    const userMatches = typeFilter === "stand" ? [] : (data?.userMatches ?? []);
    const standMatches = typeFilter === "user" ? [] : (data?.standMatches ?? []);
    return [...userMatches, ...standMatches].filter(
      (match) => !needle || rowMatchesSearch(match, needle),
    );
  }, [data, needle, typeFilter]);

  if (isLoading) return <OverviewSkeleton />;
  if (error || !data) return <ErrorAlert title={"Klarte ikke laste inn overleveringer"} />;

  const rawTotal = data.userMatches.length + data.standMatches.length;
  const unfinished = rows.filter((match) => !isRowFulfilled(match));
  const finished = rows.filter(isRowFulfilled);

  const shownUnfinished = unfinished.slice(0, ROW_CAP);
  const shownFinished = finished.slice(0, Math.max(0, ROW_CAP - shownUnfinished.length));
  const shownCount = shownUnfinished.length + shownFinished.length;

  return (
    <Stack gap={"lg"}>
      <Group align={"flex-end"} gap={"md"} wrap={"wrap"}>
        <TextInput
          style={{ flex: 1, minWidth: 220 }}
          leftSection={<IconSearch size={18} />}
          placeholder={"Søk etter navn, telefon eller e-post"}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Stack gap={4} align={"flex-start"}>
          <Input.Label>Type</Input.Label>
          <SegmentedControl
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as MatchTypeFilter)}
            data={[
              { label: "Begge", value: "both" },
              { label: "Elev", value: "user" },
              { label: "Stand", value: "stand" },
            ]}
          />
        </Stack>
      </Group>

      {rawTotal > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <StatTile
            label={"Totalt"}
            value={rows.length}
            icon={<IconArrowsExchange />}
            color={"blue"}
          />
          <StatTile
            label={"Påbegynt"}
            value={unfinished.length}
            icon={<IconProgress />}
            color={"yellow"}
          />
          <StatTile
            label={"Fullført"}
            value={finished.length}
            icon={<IconCircleCheck />}
            color={"teal"}
          />
        </SimpleGrid>
      )}

      {shownCount < rows.length && (
        <Text c={"dimmed"} size={"sm"}>
          Viser {shownCount} av {rows.length}. Søk for å avgrense listen.
        </Text>
      )}

      {rows.length === 0 ? (
        <OverviewEmptyState filtered={rawTotal > 0} />
      ) : (
        <>
          <MatchGroup heading={"Påbegynte overleveringer"} matches={shownUnfinished} />
          <MatchGroup heading={"Fullførte overleveringer"} matches={shownFinished} />
        </>
      )}
    </Stack>
  );
}
