import { Text, Title } from "@mantine/core";
import { Activity } from "react";

import {
  isBegun,
  isFullyFulfilled,
  type ViewerMatch,
  viewerProgress,
} from "@/features/matches/forViewer";
import { formatActionsString, MatchTitle } from "@/features/matches/matchesList/helper";
import MatchListItemCard from "@/features/matches/matchesList/MatchListItemCard";
import MeetingInfo from "@/features/matches/MeetingInfo";
import ProgressBar from "@/shared/components/ProgressBar";

export default function MatchListItem({ viewerMatch }: { viewerMatch: ViewerMatch }) {
  const progress = viewerProgress(viewerMatch);
  const finished = isFullyFulfilled(viewerMatch);
  const started = isBegun(viewerMatch);

  return (
    <MatchListItemCard finished={finished} matchId={viewerMatch.id}>
      <Title order={4}>
        <MatchTitle viewerMatch={viewerMatch} />
      </Title>

      <Activity mode={started ? "visible" : "hidden"}>
        <ProgressBar
          percentComplete={progress.percent}
          subtitle={<Text size={"sm"}>{progress.label}</Text>}
        />
      </Activity>
      <Activity mode={!started && !finished ? "visible" : "hidden"}>
        <Text>
          {formatActionsString(viewerMatch.toDeliver.length, viewerMatch.toReceive.length)}
        </Text>
      </Activity>
      <Activity mode={!finished ? "visible" : "hidden"}>
        <MeetingInfo
          meetingLocation={viewerMatch.meetingLocation}
          meetingTime={viewerMatch.meetingTime}
        />
      </Activity>
    </MatchListItemCard>
  );
}
