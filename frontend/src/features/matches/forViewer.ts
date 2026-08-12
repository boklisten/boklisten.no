import type {
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

export interface ViewerObligation extends MatchObligationDto {
  side: ObligationSide;
  /** The party the viewer was set up to deal with for this book. */
  expected: HandoverParty;
  /** Whether the viewer has done their part. */
  fulfilled: boolean;
}

/** Whether the whole book is done — both parties' halves. The stand owes nothing either way. */
export function isObligationSettled(obligation: MatchObligationDto): boolean {
  return (
    (obligation.sender.kind === "stand" || obligation.senderHandover !== null) &&
    (obligation.receiver.kind === "stand" || obligation.receiverHandover !== null)
  );
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
  const viewer = deliver ? obligation.sender : obligation.receiver;
  const ownHalf = deliver ? obligation.senderHandover : obligation.receiverHandover;
  const otherHalf = deliver ? obligation.receiverHandover : obligation.senderHandover;

  return {
    ...obligation,
    side,
    expected: deliver ? obligation.receiver : obligation.sender,
    // A stand half never gets its own handover, so it is settled by the other half's event:
    // handing a book out at the stand *is* the student receiving it.
    fulfilled: (viewer.kind === "stand" ? otherHalf : ownHalf) !== null,
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

/**
 * "1 av 2 bøker mottatt" — the viewer's own progress. The verb names the outcome, not the act:
 * books handed out at the stand are scanned by the staff, so a student can be fully fulfilled
 * without ever touching a scanner.
 */
export function viewerProgress(viewerMatch: ViewerMatch): { percent: number; label: string } {
  const obligations = allObligations(viewerMatch);
  const fulfilled = countFulfilled(obligations);
  const verb =
    viewerMatch.toReceive.length === 0
      ? "levert"
      : viewerMatch.toDeliver.length === 0
        ? "mottatt"
        : "utvekslet";
  const noun = obligations.length === 1 ? "bok" : "bøker";
  return {
    percent: obligations.length === 0 ? 100 : (fulfilled * 100) / obligations.length,
    label: `${fulfilled} av ${obligations.length} ${noun} ${verb}`,
  };
}

/** How a party reads in the middle of a sentence — the stand gets an article, customers a name. */
function partyLabel(party: HandoverParty): string {
  return party.kind === "stand" ? "standen" : party.name || "en annen elev";
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** partyLabel at the start of a sentence ("Standen", "En annen elev"). */
function partyLabelCapitalized(party: HandoverParty): string {
  return capitalized(partyLabel(party));
}

/**
 * What to tell the reader about one book, beyond the ticks in the table. Built from one fragment
 * per half; a half that went as planned contributes nothing, and neither does a book nobody has
 * moved, so the note is null in the happy path.
 *
 * Without `viewerName` the note speaks to the obligation's own party ("du"); with it, the note
 * speaks *about* them by name, for the admin pages. That also decides whose outstanding side is
 * stated: a student is only told what they themselves still owe, an admin is told both.
 */
export function describeObligation(
  obligation: ViewerObligation,
  viewerName?: string,
): string | null {
  const { title, sender, receiver, senderHandover, receiverHandover } = obligation;

  const watchingBothParties = viewerName !== undefined;
  const viewerIsSender = obligation.side === "deliver";
  const speakingToSender = viewerIsSender && !watchingBothParties;
  const senderLabel = viewerIsSender ? (viewerName ?? "Du") : partyLabelCapitalized(sender);
  const receiverLabel = viewerIsSender ? partyLabelCapitalized(receiver) : (viewerName ?? "Du");
  const sendersCopy = speakingToSender ? `din «${title}»` : `${partyLabel(sender)} sin «${title}»`;

  // Facts first, open obligations last, so the note ends on the open question.
  const happened: string[] = [];
  const outstanding: string[] = [];

  // The stand owes no copy of its own and is owed none, so its side never has anything to report.
  if (sender.kind !== "stand") {
    if (senderHandover === null) {
      if (receiverHandover !== null && (watchingBothParties || viewerIsSender)) {
        outstanding.push(
          `${senderLabel} er fortsatt ansvarlig for å levere ${speakingToSender ? "din" : "sin"} opprinnelige bok.`,
        );
      }
    } else if (!isSameParty(senderHandover.to, receiver)) {
      happened.push(
        senderHandover.to.kind === "stand"
          ? // Passive on purpose: the record shows whose book moved, never who carried it.
            `${capitalized(sendersCopy)} ble levert på stand.`
          : `${partyLabelCapitalized(senderHandover.to)} skannet ${sendersCopy}.`,
      );
    }
  }

  if (receiver.kind !== "stand") {
    if (receiverHandover === null) {
      // Only once the sender's copy has demonstrably gone elsewhere — a plain pending book stays
      // silent, since the tick already says "not yet".
      if (senderHandover !== null && (watchingBothParties || !viewerIsSender)) {
        outstanding.push(`${receiverLabel} har ikke fått noen bok enda.`);
      }
    } else if (!isSameParty(receiverHandover.from, sender)) {
      happened.push(
        receiverHandover.from.kind === "stand"
          ? `${receiverLabel} fikk «${title}» fra standen.`
          : `${receiverLabel} skannet ${partyLabel(receiverHandover.from)} sin «${title}».`,
      );
    }
  }

  const note = [...happened, ...outstanding].join(" ");
  return note === "" ? null : note;
}
