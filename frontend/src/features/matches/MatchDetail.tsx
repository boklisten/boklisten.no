import { Box, Skeleton } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { forViewer } from "@/features/matches/forViewer";
import MatchDetailView from "@/features/matches/MatchDetailView";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import TanStackButton from "@/shared/components/TanStackButton";
import { api } from "@/shared/utils/apiClient";
import useAuth from "@/shared/hooks/useAuth";
import { GENERIC_ERROR_TEXT, PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

function MatchDetail({ matchId }: { matchId: string }) {
  const { userId } = useAuth();

  const { data, isLoading, isError } = useQuery(
    api.matches.me.queryOptions({}, { staleTime: 5000 }),
  );

  if (isLoading) {
    return <Skeleton height={500} />;
  }

  if (isError || !data || !userId) {
    return <ErrorAlert title={GENERIC_ERROR_TEXT}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }

  const match = data.find((candidate) => candidate.id === matchId);
  if (!match) {
    return <ErrorAlert>Kunne ikke finne en overlevering med ID {matchId}.</ErrorAlert>;
  }

  return (
    <>
      <Box>
        <TanStackButton to="/overleveringer" variant="subtle" leftSection={<IconArrowLeft />}>
          Alle overleveringer
        </TanStackButton>
      </Box>

      <MatchDetailView viewerMatch={forViewer(match, userId)} viewerCustomerId={userId} />
    </>
  );
}

export default MatchDetail;
