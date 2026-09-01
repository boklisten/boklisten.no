import type { HandoverParty, MatchDto } from "@boklisten/backend/shared/match/match-dto";
import { Group, Text } from "@mantine/core";
import { IconChevronsRight, IconSwitchHorizontal } from "@tabler/icons-react";

import { isObligationSettled, isSameParty, partyName } from "@/features/matches/forViewer";

/** "1 av 2 bøker overlevert" — progress in whole books; a peer scan settles both halves at once. */
export function matchProgress(match: MatchDto): { percent: number; label: string } {
  const settled = match.obligations.filter(isObligationSettled).length;
  const total = match.obligations.length;
  return {
    percent: total > 0 ? (settled * 100) / total : 100,
    label: `${settled} av ${total} ${total === 1 ? "bok" : "bøker"} overlevert`,
  };
}

export function isMatchFinished(match: MatchDto): boolean {
  return match.obligations.every(isObligationSettled);
}

export function isMatchBegun(match: MatchDto): boolean {
  // Any recorded handover counts, even one that settled only half a book.
  return match.obligations.some(
    (obligation) => obligation.senderHandover !== null || obligation.receiverHandover !== null,
  );
}

export function orderedParties(match: MatchDto): HandoverParty[] {
  const [first, second] = match.participants;
  if (!first || !second) {
    return match.participants;
  }
  const firstDelivers = match.obligations.some((obligation) =>
    isSameParty(obligation.sender, first),
  );
  return firstDelivers ? [first, second] : [second, first];
}

export function AdminMatchTitle({ match }: { match: MatchDto }) {
  const [left, right] = orderedParties(match);
  const isExchange =
    new Set(match.obligations.map((obligation) => partyName(obligation.sender))).size > 1;

  return (
    <Group gap={2}>
      <Text fw="bold" fz="inherit">
        {left ? displayName(left) : "?"}
      </Text>
      {isExchange ? <IconSwitchHorizontal size={20} /> : <IconChevronsRight />}
      <Text fw="bold" fz="inherit">
        {right ? displayName(right) : "?"}
      </Text>
    </Group>
  );
}

export function displayName(party: HandoverParty): string {
  return party.kind === "stand" ? "Stand" : party.name;
}
