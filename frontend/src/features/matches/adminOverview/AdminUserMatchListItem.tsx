import type { UserMatchWithDetails } from "@boklisten/backend/shared/match/match-dtos";
import { Text, Title } from "@mantine/core";
import { Activity } from "react";

import { AdminUserMatchTitle } from "@/features/matches/adminOverview/adminMatchHelper";
import MatchListItemCard from "@/features/matches/matchesList/MatchListItemCard";
import MeetingInfo from "@/features/matches/MeetingInfo";
import { calculateUserMatchWholeProgress } from "@/shared/components/matches/matches-helper";
import ProgressBar from "@/shared/components/ProgressBar";

export default function AdminUserMatchListItem({ userMatch }: { userMatch: UserMatchWithDetails }) {
  const { transferred, total } = calculateUserMatchWholeProgress(userMatch);
  const finished = transferred >= total;
  const started = transferred > 0;
  return (
    <MatchListItemCard admin finished={finished} matchId={userMatch.id} matchType={"user"}>
      <Title order={4}>
        <AdminUserMatchTitle userMatch={userMatch} />
      </Title>
      <Activity mode={started && !finished ? "visible" : "hidden"}>
        <ProgressBar
          percentComplete={total > 0 ? (transferred * 100) / total : 100}
          subtitle={
            <Text size={"sm"}>
              Overlevert {transferred} av {total} bøker
            </Text>
          }
        />
      </Activity>
      <Activity mode={!finished ? "visible" : "hidden"}>
        <MeetingInfo
          meetingLocation={userMatch.meetingInfo.location}
          meetingTime={userMatch.meetingInfo.date}
        />
      </Activity>
    </MatchListItemCard>
  );
}
