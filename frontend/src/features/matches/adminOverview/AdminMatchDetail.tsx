import type { MatchDto } from "@boklisten/backend/shared/match/match-dto";
import { Stack, Text, Title } from "@mantine/core";

import { forParty, partyKey } from "@/features/matches/forViewer";
import AdminMatchContact from "@/features/matches/adminOverview/AdminMatchContact";
import {
  AdminMatchTitle,
  displayName,
  isMatchFinished,
  matchProgress,
  orderedParties,
} from "@/features/matches/adminOverview/adminMatchHelper";
import MeetingInfo from "@/features/matches/MeetingInfo";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import { MatchHeader } from "@/shared/components/matches/matches-helper";
import MatchItemTable from "@/shared/components/matches/MatchItemTable";
import ProgressBar from "@/shared/components/ProgressBar";

export default function AdminMatchDetail({ match }: { match: MatchDto }) {
  const { settled, total } = matchProgress(match);
  const finished = isMatchFinished(match);
  const parties = orderedParties(match);

  return (
    <Stack gap={"xl"}>
      <Stack gap={"xs"}>
        <Title>
          <AdminMatchTitle match={match} />
        </Title>
        {finished && <SuccessAlert>Alle bøkene i denne overleveringen er overlevert.</SuccessAlert>}
        <ProgressBar
          percentComplete={total > 0 ? (settled * 100) / total : 100}
          subtitle={
            <>
              Fullført {settled} av {total} leveringer og mottak
            </>
          }
        />
      </Stack>

      <Stack gap={"xs"}>
        <MatchHeader>Møtested</MatchHeader>
        <MeetingInfo meetingLocation={match.meetingLocation} meetingTime={match.meetingTime} />
        <Text fw={"bold"}>{match.isStandMatch ? "Elev" : "Elever"}</Text>
        {parties
          .filter((party) => party.kind === "customer")
          .map((party) => (
            <AdminMatchContact
              key={partyKey(party)}
              name={party.kind === "customer" ? party.name : "Stand"}
              phone={party.kind === "customer" ? party.phone : ""}
            />
          ))}
      </Stack>

      {parties.map((party) => {
        const { toDeliver } = forParty(match, partyKey(party));
        if (toDeliver.length === 0) return null;
        const other = parties.find((candidate) => partyKey(candidate) !== partyKey(party));
        return (
          <Stack gap={0} key={partyKey(party)}>
            <MatchHeader>
              {displayName(party)} leverer disse{other ? ` til ${displayName(other)}` : ""}
            </MatchHeader>
            <MatchItemTable obligations={toDeliver} viewerName={displayName(party)} />
          </Stack>
        );
      })}
    </Stack>
  );
}
