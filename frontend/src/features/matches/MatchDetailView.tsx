import { Button, Modal, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { IconObjectScan, IconQrcode } from "@tabler/icons-react";
import dayjs from "dayjs";
import { QRCodeSVG } from "qrcode.react";
import { Activity, useEffect, useState } from "react";

import {
  allObligations,
  countFulfilled,
  isFullyFulfilled,
  partyName,
  type ViewerMatch,
} from "@/features/matches/forViewer";
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
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";

function useIsTooEarly(meetingTime: string | null) {
  const [isTooEarly, setIsTooEarly] = useState(dayjs().isBefore(dayjs(meetingTime)));

  useEffect(() => {
    if (!meetingTime) return;
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
  onItemTransferred,
}: {
  viewerMatch: ViewerMatch;
  viewerCustomerId: string;
  onItemTransferred?: (() => void) | undefined;
}) {
  const { client } = useApiClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [redirectCountdownStarted, setRedirectCountdownStarted] = useState(false);
  const tooEarly = useIsTooEarly(viewerMatch.meetingTime);

  const { toDeliver, toReceive, isStandMatch, counterparty } = viewerMatch;
  const obligations = allObligations(viewerMatch);
  const fulfilled = countFulfilled(obligations);
  const finished = isFullyFulfilled(viewerMatch);

  // Completion is observed on the refetched match rather than in the scan callback, which only
  // sees the match as it was when the scanner opened. Gating on the scanner being open keeps a
  // student who merely revisits a finished match from being redirected away.
  useEffect(() => {
    if (finished && opened) {
      close();
      setRedirectCountdownStarted(true);
    }
  }, [finished, opened, close]);

  const statusText =
    toDeliver.length > 0 && toReceive.length === 0
      ? "levert"
      : toReceive.length > 0 && toDeliver.length === 0
        ? "skannet"
        : "utvekslet";

  const canScan = !isStandMatch && toReceive.length > 0;

  return (
    <Stack gap={"xl"}>
      <Stack gap={"xs"}>
        <Title>
          <MatchTitle viewerMatch={viewerMatch} />
        </Title>

        <Activity mode={finished ? "visible" : "hidden"}>
          <SuccessAlert>Du har {statusText} alle bøkene for denne overleveringen.</SuccessAlert>
          <Activity mode={redirectCountdownStarted ? "visible" : "hidden"}>
            <CountdownToRedirect path={"/overleveringer"} seconds={5} />
          </Activity>
        </Activity>

        <ProgressBar
          percentComplete={obligations.length === 0 ? 100 : (fulfilled * 100) / obligations.length}
          subtitle={
            <>
              {fulfilled} av {obligations.length} bøker {statusText}
            </>
          }
        />
      </Stack>

      <Activity mode={finished ? "hidden" : "visible"}>
        <Activity mode={isStandMatch ? "hidden" : "visible"}>
          <Stack gap={"xs"}>
            <Title order={2}>Hvordan fungerer det?</Title>
            <Text>
              Du skal møte en annen elev og utveksle bøker. Det er viktig at den som mottar bøker
              skanner hver bok, hvis ikke blir ikke bøkene registrert som levert, og avsender kan få
              faktura. Hvis en bok er ødelagt, skal den ikke tas imot.
            </Text>
          </Stack>
        </Activity>

        <Stack gap={"xs"}>
          <MatchHeader>{isStandMatch ? "Du skal på stand" : "Du skal møte"}</MatchHeader>
          {counterparty && !isStandMatch && <OtherPersonContact party={counterparty} />}
          <MeetingInfo
            meetingLocation={viewerMatch.meetingLocation}
            meetingTime={viewerMatch.meetingTime}
          />
        </Stack>
      </Activity>

      <Activity mode={isStandMatch ? "visible" : "hidden"}>
        <Stack align={"center"} w={"100%"}>
          <Button
            leftSection={<IconQrcode />}
            onClick={() =>
              modals.open({
                title: "Kunde-ID",
                children: (
                  <Stack align={"center"} w={"100%"}>
                    <QRCodeSVG value={viewerCustomerId} />
                    <Activity mode={viewerMatch.meetingTime ? "visible" : "hidden"}>
                      <Title>
                        Oppmøte {norwegianTime(viewerMatch.meetingTime).format("HH:mm")}
                      </Title>
                    </Activity>
                    <Activity mode={tooEarly ? "visible" : "hidden"}>
                      <InfoAlert title={"For tidlig ute"}>
                        Din oppmøtetid har ikke kommet enda. Vent med å stille deg i kø til
                        tidspunktet du har fått tildelt.
                      </InfoAlert>
                    </Activity>
                  </Stack>
                ),
              })
            }
          >
            Vis kunde-ID
          </Button>
        </Stack>
      </Activity>

      <Activity mode={canScan && fulfilled < obligations.length ? "visible" : "hidden"}>
        <Stack gap={"xs"}>
          <MatchHeader>Når du skal motta bøker</MatchHeader>
          <Text>For å motta bøker må du skanne dem</Text>
          <ScannerTutorial />
          <Button color={"green"} leftSection={<IconObjectScan />} onClick={open}>
            Skann bøker
          </Button>
          <Modal opened={opened} onClose={close} title={"Skann bøker"}>
            <ScannerPanel
              allowManualEntry
              accepts={["blid"]}
              successMessage={"Boken har blitt registrert!"}
              onScan={async (blid) => {
                const response = await client.api.matches.transferItem({ body: { blid } });
                return response.feedback ? { message: response.feedback } : undefined;
              }}
              onSuccess={onItemTransferred}
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
