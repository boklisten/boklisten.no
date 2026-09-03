import { Stack, Title } from "@mantine/core";

import PhoneFrame from "@/features/bokflyt/PhoneFrame";
import type { ViewerMatch } from "@/features/matches/forViewer";
import MatchOverview from "@/features/matches/matchesList/MatchOverview";

/** The student's own overview, exactly as the "Mine overleveringer" page shows it. */
export default function StudentMatches({ viewerMatches }: { viewerMatches: ViewerMatch[] }) {
  return (
    <PhoneFrame label="Ronjas oversikt over hvem hun skal møte, hvor og når, med bøkene som skal byttes">
      <Stack gap="md">
        <Title order={3}>Mine overleveringer</Title>
        <MatchOverview viewerMatches={viewerMatches} />
      </Stack>
    </PhoneFrame>
  );
}
