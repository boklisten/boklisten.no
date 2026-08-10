import { createFileRoute } from "@tanstack/react-router";

import MatchDetail from "@/features/matches/MatchDetail";

export const Route = createFileRoute("/(offentlig)/overleveringer/$matchId")({
  head: () => ({
    meta: [
      { title: "Overlevering av bøker | Boklisten.no" },
      {
        description: "Overleveringer av bøker",
      },
    ],
  }),
  component: MatchDetailPage,
});

function MatchDetailPage() {
  const { matchId } = Route.useParams();
  return <MatchDetail matchId={matchId} />;
}
