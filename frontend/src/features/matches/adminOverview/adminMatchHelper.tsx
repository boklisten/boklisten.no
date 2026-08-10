import type { HandoverParty, MatchDto } from "@boklisten/backend/shared/match/match-dto";
import { Group, Text } from "@mantine/core";
import { IconChevronsRight, IconSwitchHorizontal } from "@tabler/icons-react";

import { isSameParty, partyName } from "@/features/matches/forViewer";

export function matchProgress(match: MatchDto): { settled: number; total: number } {
  let settled = 0;
  let total = 0;
  for (const obligation of match.obligations) {
    if (obligation.sender.kind === "customer") {
      total++;
      if (obligation.senderHandover) settled++;
    }
    if (obligation.receiver.kind === "customer") {
      total++;
      if (obligation.receiverHandover) settled++;
    }
  }
  return { settled, total };
}

export function isMatchFinished(match: MatchDto): boolean {
  const { settled, total } = matchProgress(match);
  return settled >= total;
}

export function isMatchBegun(match: MatchDto): boolean {
  return matchProgress(match).settled > 0;
}

export function orderedParties(match: MatchDto): HandoverParty[] {
  const [first, second] = match.participants;
  if (!first || !second) return match.participants;
  const firstDelivers = match.obligations.some((obligation) =>
    isSameParty(obligation.sender, first),
  );
  return firstDelivers ? [first, second] : [second, first];
}

export const AdminMatchTitle = ({ match }: { match: MatchDto }) => {
  const [left, right] = orderedParties(match);
  const isExchange =
    new Set(match.obligations.map((obligation) => partyName(obligation.sender))).size > 1;

  return (
    <Group gap={2}>
      <Text fw={"bold"} fz={"inherit"}>
        {left ? displayName(left) : "?"}
      </Text>
      {isExchange ? <IconSwitchHorizontal size={20} /> : <IconChevronsRight />}
      <Text fw={"bold"} fz={"inherit"}>
        {right ? displayName(right) : "?"}
      </Text>
    </Group>
  );
};

export function displayName(party: HandoverParty): string {
  return party.kind === "stand" ? "Stand" : party.name;
}
