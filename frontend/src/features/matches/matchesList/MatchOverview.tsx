import { Stack } from "@mantine/core";
import { Activity } from "react";

import { isFullyFulfilled } from "@/features/matches/forViewer";
import type { ViewerMatch } from "@/features/matches/forViewer";
import MatchListItemGroups from "@/features/matches/matchesList/MatchListItemGroups";
import ProgressBar from "@/shared/components/ProgressBar";

/** A student's matches: overall progress, the ones left to do, and the ones already done. */
export default function MatchOverview({ viewerMatches }: { viewerMatches: ViewerMatch[] }) {
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
