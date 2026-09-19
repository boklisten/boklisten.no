import type { HandoverParty, MatchDto } from "@boklisten/backend/shared/match/match-dto";
import { Group, Text } from "@mantine/core";
import { IconChevronsRight, IconSwitchHorizontal } from "@tabler/icons-react";

import CustomerLink from "@/features/kasse/CustomerLink";
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

/**
 * "A → B" or "A ⇄ B". Inside the list card, which is itself a link, the names stay plain; on the
 * match's own page (`linked`) each student's name opens them in Kasse.
 */
export function AdminMatchTitle({ match, linked = false }: { match: MatchDto; linked?: boolean }) {
  const [left, right] = orderedParties(match);
  const isExchange =
    new Set(match.obligations.map((obligation) => partyName(obligation.sender))).size > 1;

  return (
    <Group gap={2}>
      <Text fw="bold" fz="inherit">
        {left ? <PartyName party={left} linked={linked} /> : "?"}
      </Text>
      {isExchange ? <IconSwitchHorizontal size={20} /> : <IconChevronsRight />}
      <Text fw="bold" fz="inherit">
        {right ? <PartyName party={right} linked={linked} /> : "?"}
      </Text>
    </Group>
  );
}

function displayName(party: HandoverParty): string {
  return party.kind === "stand" ? "Stand" : party.name;
}

/** A party's name in running text: the stand as a word, a student as a link into Kasse. */
export function PartyName({ party, linked = true }: { party: HandoverParty; linked?: boolean }) {
  if (party.kind === "stand" || !linked) {
    return displayName(party);
  }
  return (
    <CustomerLink detailsId={party.customerId} inherit>
      {party.name}
    </CustomerLink>
  );
}
