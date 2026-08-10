import type {
  HandoverDto,
  HandoverParty,
  MatchDto,
  MatchObligationDto,
} from "@boklisten/backend/shared/match/match-dto";

export function partyKey(party: HandoverParty): string {
  return party.kind === "stand" ? "stand" : party.customerId;
}

export function partyName(party: HandoverParty): string {
  return party.kind === "stand" ? "stand" : party.name;
}

export function isSameParty(a: HandoverParty, b: HandoverParty): boolean {
  return partyKey(a) === partyKey(b);
}

export type ObligationSide = "deliver" | "receive";

export interface ViewerObligation {
  id: string;
  itemId: string;
  title: string;
  side: ObligationSide;
  /** The party the viewer was set up to deal with for this book. */
  expected: HandoverParty;
  /** The party they actually dealt with, once the book moved. Null while nothing has happened. */
  actual: HandoverParty | null;
  lockedToMatch: boolean;
  /** The handover that settles the viewer's own half, if it has happened. */
  handover: HandoverDto | null;
  /** Whether the viewer's own half is settled. Never a prediction — only a recorded event. */
  fulfilled: boolean;
  /** The book moved, but not with the party the viewer was set up with. */
  wentElsewhere: boolean;
  /**
   * Deliver side only: the receiver has already been served by somebody else, so the viewer still
   * owes their own copy even though the book the receiver wanted has arrived.
   */
  otherHalfSettled: boolean;
  /**
   * Deliver side only: whoever actually served the expected receiver, when that has happened.
   * This is who "noen andre" turned out to be, and every party gets to see the name.
   */
  otherHalfParty: HandoverParty | null;
}

export interface ViewerMatch {
  id: string;
  isStandMatch: boolean;
  meetingLocation: string;
  meetingTime: string | null;
  /** The other party in the match — another student, or the stand. */
  counterparty: HandoverParty | null;
  toDeliver: ViewerObligation[];
  toReceive: ViewerObligation[];
}

function toViewerObligation(
  obligation: MatchObligationDto,
  side: ObligationSide,
): ViewerObligation {
  const deliver = side === "deliver";
  const handover = deliver ? obligation.senderHandover : obligation.receiverHandover;
  const expected = deliver ? obligation.receiver : obligation.sender;
  const actual = handover ? (deliver ? handover.to : handover.from) : null;

  return {
    id: obligation.id,
    itemId: obligation.itemId,
    title: obligation.title,
    side,
    expected,
    actual,
    lockedToMatch: obligation.lockedToMatch,
    handover,
    fulfilled: handover !== null,
    wentElsewhere: actual !== null && !isSameParty(actual, expected),
    otherHalfSettled: deliver && handover === null && obligation.receiverHandover !== null,
    otherHalfParty: deliver ? (obligation.receiverHandover?.from ?? null) : null,
  };
}

/**
 * The match from the side of whichever party the key names — a customer id, or `"stand"`.
 *
 * The admin views need the stand's side too, which is why this takes a key rather than a customer
 * id: the stand is a party like any other.
 */
export function forParty(match: MatchDto, viewerPartyKey: string): ViewerMatch {
  const isViewer = (party: HandoverParty) => partyKey(party) === viewerPartyKey;

  return {
    id: match.id,
    isStandMatch: match.isStandMatch,
    meetingLocation: match.meetingLocation,
    meetingTime: match.meetingTime,
    counterparty: match.participants.find((party) => !isViewer(party)) ?? null,
    toDeliver: match.obligations
      .filter((obligation) => isViewer(obligation.sender))
      .map((obligation) => toViewerObligation(obligation, "deliver")),
    toReceive: match.obligations
      .filter((obligation) => isViewer(obligation.receiver))
      .map((obligation) => toViewerObligation(obligation, "receive")),
  };
}

/** The match as the signed-in student sees it. */
export function forViewer(match: MatchDto, viewerCustomerId: string): ViewerMatch {
  return forParty(match, viewerCustomerId);
}

/** Every book the viewer is a party to, both directions. */
export function allObligations(viewerMatch: ViewerMatch): ViewerObligation[] {
  return [...viewerMatch.toDeliver, ...viewerMatch.toReceive];
}

export function countFulfilled(obligations: ViewerObligation[]): number {
  return obligations.filter((obligation) => obligation.fulfilled).length;
}

export function isFullyFulfilled(viewerMatch: ViewerMatch): boolean {
  const obligations = allObligations(viewerMatch);
  return countFulfilled(obligations) >= obligations.length;
}

export function isBegun(viewerMatch: ViewerMatch): boolean {
  return countFulfilled(allObligations(viewerMatch)) > 0;
}

/** How a party reads in the middle of a sentence — the stand gets an article, customers a name. */
function partyLabel(party: HandoverParty): string {
  return party.kind === "stand" ? "standen" : party.name || "en annen elev";
}

/** partyLabel at the start of a sentence ("Standen", "En annen elev"). */
function partyLabelCapitalized(party: HandoverParty): string {
  const label = partyLabel(party);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * The book named by whose copy it was: "Ole sin «Pasos 2020»", or "«Pasos 2020» fra standen" —
 * the stand holds a pile, not a particular student's copy.
 *
 * A wrong-party handover is usually two students mixing up physical copies, so the notes talk
 * about whose book ended up where rather than implying a deliberate delivery from a stranger.
 */
function copyFrom(owner: HandoverParty, title: string): string {
  return owner.kind === "stand" ? `«${title}» fra standen` : `${partyLabel(owner)} sin «${title}»`;
}

/**
 * What to tell the viewer about one book, beyond the tick in the table.
 *
 * Returns null when there is nothing to add — including for every book that has not moved yet. A
 * pending obligation is pending, and that is all we know: claiming a book will never arrive would
 * mean claiming to know what somebody is physically holding.
 *
 * Without `viewerName` the note speaks to the obligation's own party ("du"). With it, the note
 * speaks *about* them by name — the admin pages show every party's books at once, so "du" there
 * would point at nobody.
 */
export function describeObligation(
  obligation: ViewerObligation,
  viewerName?: string,
): string | null {
  const { title, expected, actual } = obligation;
  const subject = viewerName ?? "Du";

  if (obligation.side === "receive") {
    if (obligation.wentElsewhere && actual) {
      return `${subject} har skannet ${copyFrom(actual, title)}. Boka er registrert.`;
    }
    return null;
  }

  if (obligation.wentElsewhere && actual) {
    return viewerName
      ? `${partyLabelCapitalized(actual)} har skannet ${subject} sin «${title}». Boka er registrert som levert.`
      : `${partyLabelCapitalized(actual)} har skannet din «${title}». Boka er registrert som levert.`;
  }
  if (obligation.otherHalfSettled) {
    const source = obligation.otherHalfParty;
    const received = source
      ? `${partyLabelCapitalized(expected)} har skannet ${copyFrom(source, title)}.`
      : `${partyLabelCapitalized(expected)} har allerede skannet noen andre sin «${title}».`;
    return viewerName
      ? `${received} ${subject} er fortsatt ansvarlig for å levere sin opprinnelige bok.`
      : `${received} Du er fortsatt ansvarlig for å levere din opprinnelige bok.`;
  }
  return null;
}
