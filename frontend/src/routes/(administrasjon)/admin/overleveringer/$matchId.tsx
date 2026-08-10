import { Container, Skeleton, Stack } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import AdminMatchDetail from "@/features/matches/adminOverview/AdminMatchDetail";
import { validateAdminMatchListSearch } from "@/features/matches/adminOverview/adminMatchListSearch";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useApiClient from "@/shared/hooks/useApiClient";

export const Route = createFileRoute("/(administrasjon)/admin/overleveringer/$matchId")({
  validateSearch: validateAdminMatchListSearch,
  head: () => ({ meta: [{ title: "Overlevering | bl-admin" }] }),
  component: AdminMatchDetailPage,
});

function AdminMatchDetailPage() {
  const { matchId } = Route.useParams();
  const { api } = useApiClient();
  const {
    data: match,
    error,
    isLoading,
  } = useQuery(
    api.matches.getMatchById.queryOptions({ params: { matchId } }, { staleTime: 30_000 }),
  );

  return (
    <Container size={"lg"} py={"lg"}>
      <Stack gap={"lg"}>
        <TanStackAnchor to={"/admin/overleveringer"} search={(previous) => previous}>
          ← Alle overleveringer
        </TanStackAnchor>
        {isLoading ? (
          <Skeleton height={200} />
        ) : error ? (
          <ErrorAlert title={"Klarte ikke laste inn overleveringen"} />
        ) : match ? (
          <AdminMatchDetail match={match} />
        ) : (
          <InfoAlert title={"Fant ikke overleveringen"} />
        )}
      </Stack>
    </Container>
  );
}
