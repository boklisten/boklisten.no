import { Title } from "@mantine/core";
import AuthGuard from "@/features/auth/AuthGuard";
import MatchList from "@/features/matches/matchesList/MatchList";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/overleveringer/")({
  head: () =>
    seo({
      title: "Mine overleveringer | Boklisten.no",
      description: "Overleveringer av bøker",
    }),
  component: MatchesPage,
});

function MatchesPage() {
  return (
    <AuthGuard>
      <Title>Mine overleveringer</Title>
      <MatchList />
    </AuthGuard>
  );
}
