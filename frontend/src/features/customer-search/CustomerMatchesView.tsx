import type { MatchDto } from "@boklisten/backend/shared/match/match-dto";
import { Accordion, Badge, Group, Skeleton, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { isMatchFinished, matchProgress } from "@/features/matches/adminOverview/adminMatchHelper";
import AdminMatchContact from "@/features/matches/adminOverview/AdminMatchContact";
import SendMatchToStandButton from "@/features/matches/adminOverview/SendMatchToStandButton";
import { forViewer, partyName } from "@/features/matches/forViewer";
import MeetingInfo from "@/features/matches/MeetingInfo";
import { sortByMeeting } from "@/features/matches/sortByMeeting";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import MatchItemTable from "@/shared/components/matches/MatchItemTable";
import ProgressBar from "@/shared/components/ProgressBar";
import useApiClient from "@/shared/hooks/useApiClient";

const POLL_INTERVAL_MS = 5000;

/** Only peer exchanges belong here — the stand match is the Bestillinger tab. */
export function peerMatches(matches: MatchDto[] | undefined): MatchDto[] {
  return sortByMeeting((matches ?? []).filter((match) => !match.isStandMatch));
}

/**
 * The row heading, phrased from the selected customer's side. The round overview shows "A → B",
 * but here every row would open with the same customer, so name only the counterparty and say
 * which way the books move.
 */
function matchSummary(match: MatchDto, customerId: string) {
  const { toDeliver, toReceive, counterparty } = forViewer(match, customerId);
  const peer = counterparty ? partyName(counterparty) : "ukjent elev";
  const direction =
    toDeliver.length > 0 && toReceive.length > 0
      ? "Bytter med"
      : toReceive.length > 0
        ? "Får bøker fra"
        : "Leverer bøker til";
  return { direction, peer };
}

/** A quiet section label — the accordion panel is too tight for the page-level match headings. */
function PanelSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={6}>
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

function MatchPanel({ match, customerId }: { match: MatchDto; customerId: string }) {
  const { toDeliver, toReceive, counterparty } = forViewer(match, customerId);
  const peer = counterparty ? partyName(counterparty) : "den andre eleven";

  return (
    <Stack gap="lg">
      <SendMatchToStandButton match={match} />

      <PanelSection label="Møtested">
        <MeetingInfo meetingLocation={match.meetingLocation} meetingTime={match.meetingTime} />
      </PanelSection>

      {counterparty?.kind === "customer" && (
        // Only the other student — the selected customer's own number is already on the card above.
        <PanelSection label="Kontakt">
          <AdminMatchContact name={counterparty.name} phone={counterparty.phone} />
        </PanelSection>
      )}

      {toDeliver.length > 0 && (
        <PanelSection label={`Leverer til ${peer}`}>
          <MatchItemTable obligations={toDeliver} adminView />
        </PanelSection>
      )}

      {toReceive.length > 0 && (
        <PanelSection label={`Får fra ${peer}`}>
          <MatchItemTable obligations={toReceive} adminView />
        </PanelSection>
      )}
    </Stack>
  );
}

export default function CustomerMatchesView({ customerId }: { customerId: string }) {
  const { api } = useApiClient();
  const {
    data: matches,
    isPending,
    isError,
  } = useQuery(
    api.matches.getMatchesForCustomer.queryOptions(
      { params: { customerId } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );

  if (isPending) {
    return (
      <Stack gap="xs">
        <Skeleton height={72} radius="sm" />
        <Skeleton height={72} radius="sm" />
      </Stack>
    );
  }

  if (isError) {
    return <ErrorAlert>Klarte ikke laste inn kundens overleveringer.</ErrorAlert>;
  }

  const visibleMatches = peerMatches(matches);

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {visibleMatches.length === 1
          ? "1 overlevering med andre elever"
          : `${visibleMatches.length} overleveringer med andre elever`}
      </Text>

      {visibleMatches.length === 0 ? (
        <InfoAlert>Kunden har ingen overleveringer med andre elever.</InfoAlert>
      ) : (
        <Accordion variant="separated" radius="md" chevronPosition="right">
          {visibleMatches.map((match) => {
            const progress = matchProgress(match);
            const finished = isMatchFinished(match);
            const summary = matchSummary(match, customerId);
            return (
              <Accordion.Item key={match.id} value={match.id}>
                <Accordion.Control>
                  <Stack gap={6} pr="xs">
                    <Group gap={6} wrap="wrap" align="baseline">
                      <Text size="sm" c="dimmed">
                        {summary.direction}
                      </Text>
                      <Text fw={600}>{summary.peer}</Text>
                      {finished && (
                        <Badge color="green" variant="light">
                          Fullført
                        </Badge>
                      )}
                    </Group>
                    <ProgressBar
                      percentComplete={progress.percent}
                      subtitle={
                        <Text size="sm" c="dimmed">
                          {progress.label}
                        </Text>
                      }
                    />
                  </Stack>
                </Accordion.Control>
                <Accordion.Panel>
                  <MatchPanel match={match} customerId={customerId} />
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
    </Stack>
  );
}
