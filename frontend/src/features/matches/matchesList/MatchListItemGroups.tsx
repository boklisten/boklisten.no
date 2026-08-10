import { Stack, Title } from "@mantine/core";

import type { ViewerMatch } from "@/features/matches/forViewer";
import MatchListItem from "@/features/matches/matchesList/MatchListItem";

export default function MatchListItemGroups({
  viewerMatches,
  heading,
}: {
  viewerMatches: ViewerMatch[];
  heading?: string;
}) {
  return (
    <Stack>
      {heading && <Title order={2}>{heading}</Title>}
      {viewerMatches.map((viewerMatch) => (
        <MatchListItem key={viewerMatch.id} viewerMatch={viewerMatch} />
      ))}
    </Stack>
  );
}
