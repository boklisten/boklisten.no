import type { UserMatchWithDetails } from "@boklisten/backend/shared/match/match-dtos";
import { Button, Modal, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconObjectScan } from "@tabler/icons-react";
import { Activity, useState } from "react";

import { UserMatchTitle } from "@/features/matches/matchesList/helper";
import MeetingInfo from "@/features/matches/MeetingInfo";
import OtherPersonContact from "@/features/matches/OtherPersonContact";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import CountdownToRedirect from "@/shared/components/CountdownToRedirect";
import {
  calculateUserMatchStatus,
  calculateItemStatuses,
  type ItemStatus,
  MatchHeader,
} from "@/shared/components/matches/matches-helper";
import MatchItemTable from "@/shared/components/matches/MatchItemTable";
import MatchScannerContent from "@/shared/components/matches/MatchScannerContent";
import ProgressBar from "@/shared/components/ProgressBar";
import ScannerModal from "@/shared/components/scanner/ScannerModal";
import ScannerTutorial from "@/shared/components/scanner/ScannerTutorial";
import useApiClient from "@/shared/hooks/useApiClient";
import { GENERIC_ERROR_TEXT } from "@/shared/utils/constants";

const UserMatchDetail = ({
  userMatch,
  handleItemTransferred,
}: {
  userMatch: UserMatchWithDetails;
  handleItemTransferred?: (() => void) | undefined;
}) => {
  const { client } = useApiClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [redirectCountdownStarted, setRedirectCountdownStarted] = useState(false);
  const userMatchStatus = calculateUserMatchStatus(userMatch);
  const { currentUser, otherUser } = userMatchStatus;

  let statusText = "";
  if (currentUser.items.length > 0 && otherUser.items.length === 0) {
    statusText = "levert";
  } else if (currentUser.wantedItems.length > 0 && otherUser.wantedItems.length === 0) {
    statusText = "mottatt";
  } else {
    statusText = "utvekslet";
  }

  const currentUserExpectedItemCount = currentUser.items.length + currentUser.wantedItems.length;
  const currentUserActualItemCount =
    currentUser.deliveredItems.length + currentUser.receivedItems.length;
  const isCurrentUserFulfilled = currentUserActualItemCount >= currentUserExpectedItemCount;

  let itemStatuses: ItemStatus[];
  try {
    itemStatuses = calculateItemStatuses(
      userMatch,
      () => [currentUser.items, currentUser.wantedItems].flat(),
      [currentUser.receivedItems, currentUser.deliveredItems].flat(),
    );
  } catch (error: any) {
    return <ErrorAlert title={GENERIC_ERROR_TEXT}>{error?.message}</ErrorAlert>;
  }

  return (
    <Stack gap={"xl"}>
      <Stack gap={"xs"}>
        <Title>
          <UserMatchTitle userMatchStatus={userMatchStatus} />
        </Title>

        <Activity mode={isCurrentUserFulfilled ? "visible" : "hidden"}>
          <SuccessAlert>Du har {statusText} alle bøkene for denne overleveringen.</SuccessAlert>
          <Activity mode={redirectCountdownStarted ? "visible" : "hidden"}>
            <CountdownToRedirect path={"/overleveringer"} seconds={5} />
          </Activity>
        </Activity>
        <ProgressBar
          percentComplete={(currentUserActualItemCount * 100) / currentUserExpectedItemCount}
          subtitle={
            <>
              {currentUserActualItemCount} av {currentUserExpectedItemCount} bøker {statusText}
            </>
          }
        />
      </Stack>
      <Activity
        mode={
          otherUser.receivedItems.some((item) => !currentUser.deliveredItems.includes(item))
            ? "visible"
            : "hidden"
        }
      >
        <WarningAlert title={`${otherUser.name} har fått bøker som tilhørte noen andre enn deg`}>
          <Text>
            Hvis det var du som ga dem bøkene, betyr det at noen andre har bøker som opprinnelig
            tilhørte deg. Du er fortsatt ansvarlig for at de blir levert, men hvis noen andre
            leverer dem for deg vil de bli markert som levert. Hvis du ikke har gitt bort bøkene du
            har, betyr det at de har fått bøker av noen andre, og du må levere på stand i stedet.
          </Text>
        </WarningAlert>
      </Activity>

      <Activity mode={isCurrentUserFulfilled ? "hidden" : "visible"}>
        <Stack gap={"xs"}>
          <Title order={2}>Hvordan fungerer det?</Title>
          <Text>
            Du skal møte en annen elev og utveksle bøker. Det er viktig at den som mottar bøker
            scanner hver bok, hvis ikke blir ikke bøkene registrert som levert, og avsender kan få
            faktura. Hvis en bok er ødelagt, skal den ikke tas imot.
          </Text>
        </Stack>
        <Stack gap={"xs"}>
          <MatchHeader>Du skal møte</MatchHeader>
          <OtherPersonContact userMatch={userMatch} />
          <MeetingInfo
            meetingLocation={userMatch.meetingInfo.location}
            meetingTime={userMatch.meetingInfo.date}
          />
        </Stack>
      </Activity>
      <Activity
        mode={
          currentUser.wantedItems.length > currentUser.receivedItems.length ? "visible" : "hidden"
        }
      >
        <Stack gap={"xs"}>
          <MatchHeader>Når du skal motta bøker</MatchHeader>
          <Text>For å motta bøker må du scanne dem</Text>
          <ScannerTutorial />
          <Button color={"green"} leftSection={<IconObjectScan />} onClick={open}>
            Scan bøker
          </Button>
          <Modal opened={opened} onClose={close} title={"Skann bøker"}>
            <ScannerModal
              allowManualRegistration
              onScan={async (blid) => {
                const response = await client.api.matches.transferItem({ body: { blid } });
                return [{ feedback: response.feedback ?? "" }];
              }}
              onSuccessfulScan={() => {
                handleItemTransferred?.();
                if (isCurrentUserFulfilled) {
                  setRedirectCountdownStarted(true);
                  close();
                }
              }}
            >
              <MatchScannerContent
                itemStatuses={itemStatuses}
                expectedItems={currentUser.wantedItems}
                fulfilledItems={currentUser.receivedItems}
              />
            </ScannerModal>
          </Modal>
        </Stack>
      </Activity>
      <Activity mode={currentUser.wantedItems.length > 0 ? "visible" : "hidden"}>
        <Stack gap={0}>
          <Activity mode={!isCurrentUserFulfilled ? "visible" : "hidden"}>
            <MatchHeader>Du skal motta disse bøkene</MatchHeader>
          </Activity>
          <MatchItemTable
            itemFilter={currentUser.wantedItems}
            itemStatuses={itemStatuses}
            isSender={false}
          />
        </Stack>
      </Activity>
      <Activity mode={currentUser.items.length > 0 ? "visible" : "hidden"}>
        <Stack gap={0}>
          <Activity mode={!isCurrentUserFulfilled ? "visible" : "hidden"}>
            <MatchHeader>Du skal levere disse bøkene</MatchHeader>
          </Activity>
          <MatchItemTable
            itemFilter={currentUser.items}
            itemStatuses={itemStatuses}
            isSender={true}
          />
        </Stack>
      </Activity>
    </Stack>
  );
};

export default UserMatchDetail;
