import type { UserMatchWithDetails } from "@boklisten/backend/shared/match/match-dtos";
import { Stack, Text, Title } from "@mantine/core";

import AdminMatchContact from "@/features/matches/adminOverview/AdminMatchContact";
import { AdminUserMatchTitle } from "@/features/matches/adminOverview/adminMatchHelper";
import MeetingInfo from "@/features/matches/MeetingInfo";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import {
  calculateItemStatuses,
  calculateUserMatchStatus,
  calculateUserMatchWholeProgress,
  type ItemStatus,
  MatchHeader,
} from "@/shared/components/matches/matches-helper";
import MatchItemTable from "@/shared/components/matches/MatchItemTable";
import ProgressBar from "@/shared/components/ProgressBar";
import { GENERIC_ERROR_TEXT } from "@/shared/utils/constants";

export default function AdminUserMatchDetail({ userMatch }: { userMatch: UserMatchWithDetails }) {
  const { currentUser: customerA, otherUser: customerB } = calculateUserMatchStatus(
    userMatch,
    userMatch.customerA,
  );
  const nameA = userMatch.customerADetails.name;
  const nameB = userMatch.customerBDetails.name;
  const { transferred, total } = calculateUserMatchWholeProgress(userMatch);
  const finished = transferred >= total;

  let aToBStatuses: ItemStatus[];
  let bToAStatuses: ItemStatus[];
  try {
    aToBStatuses = calculateItemStatuses(
      userMatch,
      () => customerA.items,
      customerA.deliveredItems,
    );
    bToAStatuses = calculateItemStatuses(
      userMatch,
      () => customerB.items,
      customerB.deliveredItems,
    );
  } catch (error: any) {
    return <ErrorAlert title={GENERIC_ERROR_TEXT}>{error?.message}</ErrorAlert>;
  }

  const hasAToB = customerA.items.length > 0;
  const hasBToA = customerB.items.length > 0;

  return (
    <Stack gap={"xl"}>
      <Stack gap={"xs"}>
        <Title>
          <AdminUserMatchTitle userMatch={userMatch} />
        </Title>
        {finished && <SuccessAlert>Alle bøkene i denne overleveringen er overlevert.</SuccessAlert>}
        <ProgressBar
          percentComplete={total > 0 ? (transferred * 100) / total : 100}
          subtitle={
            <>
              Overlevert {transferred} av {total} bøker
            </>
          }
        />
      </Stack>

      <Stack gap={"xs"}>
        <MatchHeader>Møtested</MatchHeader>
        <MeetingInfo
          meetingLocation={userMatch.meetingInfo.location}
          meetingTime={userMatch.meetingInfo.date}
        />
        <Text fw={"bold"}>Elever</Text>
        <AdminMatchContact name={nameA} phone={userMatch.customerADetails.phone} />
        <AdminMatchContact name={nameB} phone={userMatch.customerBDetails.phone} />
      </Stack>

      {hasAToB && (
        <Stack gap={0}>
          <MatchHeader>
            {nameA} leverer disse til {nameB}
          </MatchHeader>
          <MatchItemTable itemStatuses={aToBStatuses} isSender={true} />
        </Stack>
      )}
      {hasBToA && (
        <Stack gap={0}>
          <MatchHeader>
            {nameB} leverer disse til {nameA}
          </MatchHeader>
          <MatchItemTable itemStatuses={bToAStatuses} isSender={true} />
        </Stack>
      )}
    </Stack>
  );
}
