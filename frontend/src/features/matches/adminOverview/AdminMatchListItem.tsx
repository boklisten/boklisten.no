import type { MatchDto } from "@boklisten/backend/shared/match/match-dto";
import { Text, Title } from "@mantine/core";
import { Activity } from "react";

import {
  AdminMatchTitle,
  isMatchBegun,
  isMatchFinished,
  matchProgress,
} from "@/features/matches/adminOverview/adminMatchHelper";
import MatchListItemCard from "@/features/matches/matchesList/MatchListItemCard";
import MeetingInfo from "@/features/matches/MeetingInfo";
import ProgressBar from "@/shared/components/ProgressBar";

export default function AdminMatchListItem({ match }: { match: MatchDto }) {
  const { settled, total } = matchProgress(match);
  const finished = isMatchFinished(match);
  const started = isMatchBegun(match);

  return (
    <MatchListItemCard admin finished={finished} matchId={match.id}>
      <Title order={4}>
        <AdminMatchTitle match={match} />
      </Title>
      <Activity mode={started && !finished ? "visible" : "hidden"}>
        <ProgressBar
          percentComplete={total > 0 ? (settled * 100) / total : 100}
          subtitle={
            <Text size={"sm"}>
              Fullført {settled} av {total} leveringer og mottak
            </Text>
          }
        />
      </Activity>
      <Activity mode={!finished ? "visible" : "hidden"}>
        <MeetingInfo meetingLocation={match.meetingLocation} meetingTime={match.meetingTime} />
      </Activity>
    </MatchListItemCard>
  );
}
