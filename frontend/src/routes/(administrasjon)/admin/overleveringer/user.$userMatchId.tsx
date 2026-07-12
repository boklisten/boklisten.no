import { Container, Skeleton, Stack } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import AdminMatchDetail from "@/features/matches/adminOverview/AdminMatchDetail";
import useAllMatches from "@/features/matches/adminOverview/useAllMatches";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

export const Route = createFileRoute("/(administrasjon)/admin/overleveringer/user/$userMatchId")({
  head: () => ({ meta: [{ title: "Overlevering | bl-admin" }] }),
  component: AdminUserMatchDetailPage,
});

function AdminUserMatchDetailPage() {
  const { userMatchId } = Route.useParams();
  const { data, error, isLoading } = useAllMatches();
  const userMatch = data?.userMatches.find((match) => match.id === userMatchId);

  return (
    <Container size={"lg"} py={"lg"}>
      <Stack gap={"lg"}>
        <TanStackAnchor to={"/admin/overleveringer"}>← Alle overleveringer</TanStackAnchor>
        {isLoading ? (
          <Skeleton height={200} />
        ) : error || !data ? (
          <ErrorAlert title={"Klarte ikke laste inn overleveringen"} />
        ) : userMatch ? (
          <AdminMatchDetail userMatch={userMatch} />
        ) : (
          <InfoAlert title={"Fant ikke overleveringen"} />
        )}
      </Stack>
    </Container>
  );
}
