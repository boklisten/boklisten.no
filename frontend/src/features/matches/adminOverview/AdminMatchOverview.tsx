import type { MatchDto } from "@boklisten/backend/shared/match/match-dto";
import { Group, SegmentedControl, Skeleton, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";

import AdminMatchListItem from "@/features/matches/adminOverview/AdminMatchListItem";
import OverviewEmptyState from "@/features/matches/adminOverview/OverviewEmptyState";
import { isMatchBegun, isMatchFinished } from "@/features/matches/adminOverview/adminMatchHelper";
import useAllMatches from "@/features/matches/adminOverview/useAllMatches";
import { sortByMeeting } from "@/features/matches/sortByMeeting";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";

type MatchTypeFilter = "both" | "user" | "stand";

const ROW_CAP = 200;

const listRoute = getRouteApi("/(administrasjon)/admin/overleveringer/");

function rowMatchesSearch(match: MatchDto, needle: string): boolean {
  return match.participants
    .flatMap((party) => (party.kind === "customer" ? [party.name, party.phone, party.email] : []))
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function OverviewSkeleton() {
  return (
    <Stack gap="lg">
      <Group align="center" gap="md" wrap="wrap">
        <Skeleton height={36} style={{ flex: 1, minWidth: 220 }} />
        <Skeleton height={36} width={232} />
      </Group>
      <Stack>
        <Skeleton height={128} />
        <Skeleton height={128} />
        <Skeleton height={128} />
      </Stack>
    </Stack>
  );
}

function MatchGroup({ heading, matches }: { heading: string; matches: MatchDto[] }) {
  if (matches.length === 0) {
    return null;
  }
  return (
    <Stack>
      <Title order={2}>{heading}</Title>
      {matches.map((match) => (
        <AdminMatchListItem key={match.id} match={match} />
      ))}
    </Stack>
  );
}

export default function AdminMatchOverview({ roundId }: { roundId: string }) {
  const { data, error, isLoading } = useAllMatches(roundId);
  // Search and type filter live in the URL so they survive a round-trip to a
  // match detail page (and are shareable/bookmarkable).
  const { sok, type } = listRoute.useSearch();
  const navigate = listRoute.useNavigate();
  const search = sok ?? "";
  const typeFilter: MatchTypeFilter = type ?? "both";

  const needle = search.trim().toLowerCase();

  const rows = useMemo<MatchDto[]>(
    () =>
      sortByMeeting(
        (data ?? [])
          .filter(
            (match) =>
              typeFilter === "both" ||
              (typeFilter === "stand" ? match.isStandMatch : !match.isStandMatch),
          )
          .filter((match) => !needle || rowMatchesSearch(match, needle)),
      ),
    [data, needle, typeFilter],
  );

  if (isLoading) {
    return <OverviewSkeleton />;
  }
  if (error || !data) {
    return <ErrorAlert title="Klarte ikke laste inn overleveringer" />;
  }

  const unfinished = rows.filter((match) => !isMatchFinished(match));
  const begun = unfinished.filter(isMatchBegun);
  const notBegun = unfinished.filter((match) => !isMatchBegun(match));
  const finished = rows.filter(isMatchFinished);

  const shownBegun = begun.slice(0, ROW_CAP);
  const shownNotBegun = notBegun.slice(0, Math.max(0, ROW_CAP - shownBegun.length));
  const shownFinished = finished.slice(
    0,
    Math.max(0, ROW_CAP - shownBegun.length - shownNotBegun.length),
  );
  const shownCount = shownBegun.length + shownNotBegun.length + shownFinished.length;

  return (
    <Stack gap="lg">
      <Group align="center" gap="md" wrap="wrap">
        <TextInput
          style={{ flex: 1, minWidth: 220 }}
          leftSection={<IconSearch size={18} />}
          placeholder="Søk etter navn, telefon eller e-post"
          value={search}
          onChange={(event) => {
            const { value } = event.currentTarget;
            void navigate({
              search: (previous) => ({ ...previous, sok: value || undefined }),
              replace: true,
            });
          }}
        />
        <SegmentedControl
          aria-label="Type overlevering"
          value={typeFilter}
          onChange={(value) =>
            void navigate({
              search: (previous) => ({
                ...previous,
                type: value === "user" || value === "stand" ? value : undefined,
              }),
              replace: true,
            })
          }
          data={[
            { label: "Begge", value: "both" },
            { label: "Elev", value: "user" },
            { label: "Stand", value: "stand" },
          ]}
        />
      </Group>

      {shownCount < rows.length && (
        <Text c="dimmed" size="sm">
          Viser {shownCount} av {rows.length}. Søk for å avgrense listen.
        </Text>
      )}

      {rows.length === 0 ? (
        <OverviewEmptyState filtered={data.length > 0} />
      ) : (
        <>
          <MatchGroup heading="Påbegynte overleveringer" matches={shownBegun} />
          <MatchGroup heading="Ikke påbegynte overleveringer" matches={shownNotBegun} />
          <MatchGroup heading="Fullførte overleveringer" matches={shownFinished} />
        </>
      )}
    </Stack>
  );
}
