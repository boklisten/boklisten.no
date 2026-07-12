import { Container, Skeleton, Stack } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import AdminMatchDetail from "@/features/matches/adminOverview/AdminMatchDetail";
import useAllMatches from "@/features/matches/adminOverview/useAllMatches";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

export const Route = createFileRoute("/(administrasjon)/admin/overleveringer/stand/$standMatchId")({
  head: () => ({ meta: [{ title: "Overlevering | bl-admin" }] }),
  component: AdminStandMatchDetailPage,
});

function AdminStandMatchDetailPage() {
  const { standMatchId } = Route.useParams();
  const { data, error, isLoading } = useAllMatches();
  const standMatch = data?.standMatches.find((match) => match.id === standMatchId);

  return (
    <Container size={"lg"} py={"lg"}>
      <Stack gap={"lg"}>
        <TanStackAnchor to={"/admin/overleveringer"}>← Alle overleveringer</TanStackAnchor>
        {isLoading ? (
          <Skeleton height={200} />
        ) : error || !data ? (
          <ErrorAlert title={"Klarte ikke laste inn overleveringen"} />
        ) : standMatch ? (
          <AdminMatchDetail standMatch={standMatch} />
        ) : (
          <InfoAlert title={"Fant ikke overleveringen"} />
        )}
      </Stack>
    </Container>
  );
}
