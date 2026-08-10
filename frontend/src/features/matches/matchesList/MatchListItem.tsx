import { Text, Title } from "@mantine/core";
import { Activity } from "react";

import {
  allObligations,
  countFulfilled,
  isBegun,
  isFullyFulfilled,
  type ViewerMatch,
} from "@/features/matches/forViewer";
import { formatActionsString, MatchTitle } from "@/features/matches/matchesList/helper";
import MatchListItemCard from "@/features/matches/matchesList/MatchListItemCard";
import MeetingInfo from "@/features/matches/MeetingInfo";
import ProgressBar from "@/shared/components/ProgressBar";

export default function MatchListItem({ viewerMatch }: { viewerMatch: ViewerMatch }) {
  const obligations = allObligations(viewerMatch);
  const fulfilled = countFulfilled(obligations);
  const finished = isFullyFulfilled(viewerMatch);
  const started = isBegun(viewerMatch);

  const statusText =
    viewerMatch.toDeliver.length > 0 && viewerMatch.toReceive.length === 0
      ? "Levert"
      : viewerMatch.toReceive.length > 0 && viewerMatch.toDeliver.length === 0
        ? "Mottatt"
        : "Utvekslet";

  return (
    <MatchListItemCard finished={finished} matchId={viewerMatch.id}>
      <Title order={4}>
        <MatchTitle viewerMatch={viewerMatch} />
      </Title>

      <Activity mode={started ? "visible" : "hidden"}>
        <ProgressBar
          percentComplete={obligations.length === 0 ? 100 : (fulfilled * 100) / obligations.length}
          subtitle={
            <Text size={"sm"}>
              {statusText} {fulfilled} av {obligations.length} bøker
            </Text>
          }
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
