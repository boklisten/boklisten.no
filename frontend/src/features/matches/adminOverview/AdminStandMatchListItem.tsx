import type { AdminStandMatchWithDetails } from "@boklisten/backend/shared/match/match-dtos";
import { Text, Title } from "@mantine/core";
import { Activity } from "react";

import { AdminStandMatchTitle } from "@/features/matches/adminOverview/adminMatchHelper";
import MatchListItemCard from "@/features/matches/matchesList/MatchListItemCard";
import MeetingInfo from "@/features/matches/MeetingInfo";
import {
  calculateFulfilledStandMatchItems,
  isStandMatchFulfilled,
} from "@/shared/components/matches/matches-helper";
import ProgressBar from "@/shared/components/ProgressBar";

export default function AdminStandMatchListItem({
  standMatch,
}: {
  standMatch: AdminStandMatchWithDetails;
}) {
  const totalExpected =
    standMatch.expectedHandoffItems.length + standMatch.expectedPickupItems.length;
  const { fulfilledHandoffItems, fulfilledPickupItems } =
    calculateFulfilledStandMatchItems(standMatch);
  const totalFulfilled = fulfilledHandoffItems.length + fulfilledPickupItems.length;
  const started = totalFulfilled > 0;
  const finished = isStandMatchFulfilled(standMatch);
  return (
    <MatchListItemCard admin finished={finished} matchId={standMatch.id} matchType={"stand"}>
      <Title order={4}>
        <AdminStandMatchTitle standMatch={standMatch} />
      </Title>
      <Activity mode={started && !finished ? "visible" : "hidden"}>
        <ProgressBar
          percentComplete={totalExpected > 0 ? (totalFulfilled * 100) / totalExpected : 100}
          subtitle={
            <Text size={"sm"}>
              Overlevert {totalFulfilled} av {totalExpected} bøker
            </Text>
          }
        />
      </Activity>
      <Activity mode={!finished ? "visible" : "hidden"}>
        <MeetingInfo
          meetingLocation={standMatch.meetingInfo.location}
          meetingTime={standMatch.meetingInfo.date}
        />
      </Activity>
    </MatchListItemCard>
  );
}
