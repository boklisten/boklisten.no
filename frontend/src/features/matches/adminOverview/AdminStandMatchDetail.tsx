import type { AdminStandMatchWithDetails } from "@boklisten/backend/shared/match/match-dtos";
import { Stack, Text, Title } from "@mantine/core";

import AdminMatchContact from "@/features/matches/adminOverview/AdminMatchContact";
import { AdminStandMatchTitle } from "@/features/matches/adminOverview/adminMatchHelper";
import MeetingInfo from "@/features/matches/MeetingInfo";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import {
  calculateFulfilledStandMatchItems,
  calculateItemStatuses,
  isStandMatchFulfilled,
  type ItemStatus,
  MatchHeader,
} from "@/shared/components/matches/matches-helper";
import MatchItemTable from "@/shared/components/matches/MatchItemTable";
import ProgressBar from "@/shared/components/ProgressBar";
import { GENERIC_ERROR_TEXT } from "@/shared/utils/constants";

export default function AdminStandMatchDetail({
  standMatch,
}: {
  standMatch: AdminStandMatchWithDetails;
}) {
  const { fulfilledHandoffItems, fulfilledPickupItems } =
    calculateFulfilledStandMatchItems(standMatch);
  const finished = isStandMatchFulfilled(standMatch);
  const hasHandoff = standMatch.expectedHandoffItems.length > 0;
  const hasPickup = standMatch.expectedPickupItems.length > 0;

  let handoffItemStatuses: ItemStatus[];
  let pickupItemStatuses: ItemStatus[];
  try {
    handoffItemStatuses = calculateItemStatuses(
      standMatch,
      (match) => match.expectedHandoffItems,
      fulfilledHandoffItems,
    );
    pickupItemStatuses = calculateItemStatuses(
      standMatch,
      (match) => match.expectedPickupItems,
      fulfilledPickupItems,
    );
  } catch (error: any) {
    return <ErrorAlert title={GENERIC_ERROR_TEXT}>{error?.message}</ErrorAlert>;
  }

  return (
    <Stack gap={"xl"}>
      <Stack gap={"xs"}>
        <Title>
          <AdminStandMatchTitle standMatch={standMatch} />
        </Title>
        {finished && <SuccessAlert>Alle bøkene i denne overleveringen er overlevert.</SuccessAlert>}
        {hasHandoff && (
          <ProgressBar
            percentComplete={
              (fulfilledHandoffItems.length * 100) / standMatch.expectedHandoffItems.length
            }
            subtitle={
              <>
                {fulfilledHandoffItems.length} av {standMatch.expectedHandoffItems.length} bøker
                levert inn
              </>
            }
          />
        )}
        {hasPickup && (
          <ProgressBar
            percentComplete={
              (fulfilledPickupItems.length * 100) / standMatch.expectedPickupItems.length
            }
            subtitle={
              <>
                {fulfilledPickupItems.length} av {standMatch.expectedPickupItems.length} bøker
                hentet
              </>
            }
          />
        )}
      </Stack>

      <Stack gap={"xs"}>
        <MatchHeader>Møtested</MatchHeader>
        <MeetingInfo
          meetingLocation={standMatch.meetingInfo.location}
          meetingTime={standMatch.meetingInfo.date}
        />
        <Text fw={"bold"}>Elev</Text>
        <AdminMatchContact
          name={standMatch.customerDetails.name}
          phone={standMatch.customerDetails.phone}
        />
      </Stack>

      {hasHandoff && (
        <Stack gap={0}>
          <MatchHeader>Disse bøkene skal leveres inn</MatchHeader>
          <MatchItemTable itemStatuses={handoffItemStatuses} isSender={true} />
        </Stack>
      )}
      {hasPickup && (
        <Stack gap={0}>
          <MatchHeader>Disse bøkene skal hentes</MatchHeader>
          <MatchItemTable itemStatuses={pickupItemStatuses} isSender={false} />
        </Stack>
      )}
    </Stack>
  );
}
