import { Button, Modal, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconObjectScan } from "@tabler/icons-react";
import dayjs from "dayjs";
import { Activity, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { isFullyFulfilled, partyName, viewerProgress } from "@/features/matches/forViewer";
import type { ViewerMatch } from "@/features/matches/forViewer";
import { MatchTitle } from "@/features/matches/matchesList/helper";
import MeetingInfo from "@/features/matches/MeetingInfo";
import OtherPersonContact from "@/features/matches/OtherPersonContact";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import CountdownToRedirect from "@/shared/components/CountdownToRedirect";
import { MatchHeader } from "@/shared/components/matches/matches-helper";
import MatchItemTable from "@/shared/components/matches/MatchItemTable";
import MatchScannerContent from "@/shared/components/matches/MatchScannerContent";
import ProgressBar from "@/shared/components/ProgressBar";
import ScannerPanel from "@/shared/components/scanner/ScannerPanel";
import ScannerTutorial from "@/shared/components/scanner/ScannerTutorial";
import ShowCustomerIdButton from "@/shared/components/ShowCustomerIdButton";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";

function useIsTooEarly(meetingTime: string | null) {
  const [isTooEarly, setIsTooEarly] = useState(dayjs().isBefore(dayjs(meetingTime)));

  useEffect(() => {
    if (!meetingTime) {
      return undefined;
    }
    const interval = setInterval(() => {
      setIsTooEarly(dayjs().isBefore(dayjs(meetingTime)));
    }, 10_000);
    return () => clearInterval(interval);
  }, [meetingTime]);

  return isTooEarly;
}

export default function MatchDetailView({
  viewerMatch,
  viewerCustomerId,
}: {
  viewerMatch: ViewerMatch;
  viewerCustomerId: string;
}) {
  const queryClient = useQueryClient();
  const { client, api } = useApiClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [redirectCountdownStarted, setRedirectCountdownStarted] = useState(false);
  const tooEarly = useIsTooEarly(viewerMatch.meetingTime);

  const { toDeliver, toReceive, isStandMatch, counterparty } = viewerMatch;
  const progress = viewerProgress(viewerMatch);
  const finished = isFullyFulfilled(viewerMatch);

  // Completion is observed on the refetched match rather than in the scan callback, which only
  // sees the match as it was when the scanner opened. Reacting to the transition while the
  // scanner is open keeps a student who merely revisits a finished match from being redirected
  // away — a match that is already finished on first render never trips the countdown.
  const [wasFinished, setWasFinished] = useState(finished);
  if (finished !== wasFinished) {
    setWasFinished(finished);
    if (finished && opened) {
      close();
      setRedirectCountdownStarted(true);
    }
  }

  const canScan = !isStandMatch && toReceive.length > 0;

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title>
          <MatchTitle viewerMatch={viewerMatch} />
        </Title>

        <Activity mode={finished ? "visible" : "hidden"}>
          <SuccessAlert>Du er ferdig med denne overleveringen.</SuccessAlert>
          <Activity mode={redirectCountdownStarted ? "visible" : "hidden"}>
            <CountdownToRedirect path="/overleveringer" seconds={5} />
          </Activity>
        </Activity>

        <ProgressBar percentComplete={progress.percent} subtitle={progress.label} />
      </Stack>

      <Activity mode={finished ? "hidden" : "visible"}>
        <Activity mode={isStandMatch ? "hidden" : "visible"}>
          <Stack gap="xs">
            <Title order={2}>Hvordan fungerer det?</Title>
            <Text>
              Du skal møte en annen elev og utveksle bøker. Det er viktig at den som mottar bøker
              skanner hver bok, hvis ikke blir ikke bøkene registrert som levert, og avsender kan få
              faktura. Hvis en bok er ødelagt, skal den ikke tas imot.
            </Text>
          </Stack>
        </Activity>

        <Stack gap="xs">
          <MatchHeader>{isStandMatch ? "Du skal på stand" : "Du skal møte"}</MatchHeader>
          {counterparty && !isStandMatch && <OtherPersonContact party={counterparty} />}
          <MeetingInfo
            meetingLocation={viewerMatch.meetingLocation}
            meetingTime={viewerMatch.meetingTime}
          />
        </Stack>
      </Activity>

      <Activity mode={isStandMatch ? "visible" : "hidden"}>
        <Stack align="center" w="100%">
          <ShowCustomerIdButton
            customerId={viewerCustomerId}
            extraContent={
              <>
                <Activity mode={viewerMatch.meetingTime ? "visible" : "hidden"}>
                  <Title>Oppmøte {norwegianTime(viewerMatch.meetingTime).format("HH:mm")}</Title>
                </Activity>
                <Activity mode={tooEarly ? "visible" : "hidden"}>
                  <InfoAlert title="For tidlig ute">
                    Din oppmøtetid har ikke kommet enda. Vent med å stille deg i kø til tidspunktet
                    du har fått tildelt.
                  </InfoAlert>
                </Activity>
              </>
            }
          />
        </Stack>
      </Activity>

      <Activity mode={canScan && !finished ? "visible" : "hidden"}>
        <Stack gap="xs">
          <MatchHeader>Når du skal motta bøker</MatchHeader>
          <Text>For å motta bøker må du skanne dem</Text>
          <ScannerTutorial />
          <Button color="green" leftSection={<IconObjectScan />} onClick={open}>
            Skann bøker
          </Button>
          <Modal opened={opened} onClose={close} title="Skann bøker">
            <ScannerPanel
              allowManualEntry
              accepts={["blid"]}
              successMessage="Boken har blitt registrert!"
              onScan={async (blid) => {
                const response = await client.api.matches.transferItem({ body: { blid } });
                await queryClient.invalidateQueries({
                  queryKey: api.matches.getMyMatches.queryKey(),
                });
                return response.feedback ? { message: response.feedback } : undefined;
              }}
            >
              <MatchScannerContent obligations={toReceive} />
            </ScannerPanel>
          </Modal>
        </Stack>
      </Activity>

      <Activity mode={toReceive.length > 0 ? "visible" : "hidden"}>
        <Stack gap={0}>
          <MatchHeader>
            Du skal motta disse bøkene
            {counterparty && !isStandMatch ? ` fra ${partyName(counterparty)}` : ""}
          </MatchHeader>
          <MatchItemTable obligations={toReceive} />
        </Stack>
      </Activity>

      <Activity mode={toDeliver.length > 0 ? "visible" : "hidden"}>
        <Stack gap={0}>
          <MatchHeader>Du skal levere disse bøkene</MatchHeader>
          <MatchItemTable obligations={toDeliver} />
        </Stack>
      </Activity>
    </Stack>
  );
}
