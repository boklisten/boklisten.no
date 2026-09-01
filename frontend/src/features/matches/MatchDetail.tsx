import { Box, Button, Skeleton } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { forViewer } from "@/features/matches/forViewer";
import MatchDetailView from "@/features/matches/MatchDetailView";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useApiClient from "@/shared/hooks/useApiClient";
import useAuth from "@/shared/hooks/useAuth";
import { GENERIC_ERROR_TEXT, PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

function MatchDetail({ matchId }: { matchId: string }) {
  const { api } = useApiClient();
  const { detailsId } = useAuth();

  const { data, isLoading, isError } = useQuery(
    api.matches.getMyMatches.queryOptions({}, { staleTime: 5000 }),
  );

  if (isLoading) {
    return <Skeleton height={500} />;
  }

  if (isError || !data || !detailsId) {
    return <ErrorAlert title={GENERIC_ERROR_TEXT}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }

  const match = data.find((candidate) => candidate.id === matchId);
  if (!match) {
    return <ErrorAlert>Kunne ikke finne en overlevering med ID {matchId}.</ErrorAlert>;
  }

  return (
    <>
      <Box>
        <TanStackAnchor to="/overleveringer">
          <Button variant="subtle" leftSection={<IconArrowLeft />}>
            Alle overleveringer
          </Button>
        </TanStackAnchor>
      </Box>

      <MatchDetailView viewerMatch={forViewer(match, detailsId)} viewerCustomerId={detailsId} />
    </>
  );
}

export default MatchDetail;
