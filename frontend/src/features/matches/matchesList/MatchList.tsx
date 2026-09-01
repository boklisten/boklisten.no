import { Skeleton, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "react";

import { forViewer, isFullyFulfilled } from "@/features/matches/forViewer";
import MatchListItemGroups from "@/features/matches/matchesList/MatchListItemGroups";
import { sortByMeeting } from "@/features/matches/sortByMeeting";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import ProgressBar from "@/shared/components/ProgressBar";
import useApiClient from "@/shared/hooks/useApiClient";
import useAuth from "@/shared/hooks/useAuth";

export default function MatchList() {
  const { api } = useApiClient();
  const { detailsId } = useAuth();
  const { data, error, isLoading } = useQuery(
    api.matches.getMyMatches.queryOptions({}, { staleTime: 5000 }),
  );

  if (isLoading) {
    return <Skeleton height={110} />;
  }

  if (error || !data || !detailsId) {
    return <ErrorAlert title="Klarte ikke laste inn dine overleveringer" />;
  }

  if (data.length === 0) {
    return (
      <InfoAlert title="Du har ingen overleveringer :)">
        <Stack gap="xs">
          <Text size="sm">
            Har du fått melding om overleveringer? Sjekk om du er logget inn med riktig konto.
          </Text>
          <Text size="sm">Ta kontakt med info@boklisten.no om du har spørsmål.</Text>
        </Stack>
      </InfoAlert>
    );
  }

  const viewerMatches = sortByMeeting(data.map((match) => forViewer(match, detailsId)));

  const unfinished = viewerMatches.filter((viewerMatch) => !isFullyFulfilled(viewerMatch));
  const finished = viewerMatches.filter(isFullyFulfilled);

  return (
    <Stack gap="xl">
      <ProgressBar
        percentComplete={(100 * finished.length) / viewerMatches.length}
        subtitle={
          <span>
            Fullført {finished.length} av {viewerMatches.length} overleveringer
          </span>
        }
      />

      <Activity mode={unfinished.length > 0 ? "visible" : "hidden"}>
        <MatchListItemGroups viewerMatches={unfinished} />
      </Activity>
      <Activity mode={finished.length > 0 ? "visible" : "hidden"}>
        <MatchListItemGroups viewerMatches={finished} heading="Fullførte overleveringer" />
      </Activity>
    </Stack>
  );
}
