import type BookHandover from "#models/book_handover";
import type Match from "#models/match";
import type MatchObligation from "#models/match_obligation";
import { indexHandoversByHalf } from "#services/matches/obligation_status";
import type {
  HandoverDto,
  HandoverParty,
  MatchDto,
  MatchObligationDto,
} from "#shared/match/match-dto";

/** The contact details a match view needs about a customer. */
export interface MatchPerson {
  name: string;
  phone: string;
  email: string;
}

/**
 * The Mongo-side context needed to render matches.
 *
 * Passed in rather than fetched here so a caller rendering many matches makes exactly two Mongo
 * reads — one for people, one for titles — instead of two per match.
 */
export interface MatchLookups {
  /** UserDetail id → contact details. */
  people: Map<string, MatchPerson>;
  /** Item id → title. */
  titles: Map<string, string>;
}

/**
 * A customer we hold no details for still renders, blank. Deleted and inactive user details are
 * ordinary in the admin overview, and a missing name must not take the whole page down.
 */
const UNKNOWN_PERSON: MatchPerson = { name: "", phone: "", email: "" };

function toParty(customerId: string | null, lookups: MatchLookups): HandoverParty {
  if (customerId === null) {
    return { kind: "stand" };
  }
  const person = lookups.people.get(customerId) ?? UNKNOWN_PERSON;
  return { kind: "customer", customerId, ...person };
}

function toHandoverDto(handover: BookHandover, lookups: MatchLookups): HandoverDto {
  return {
    id: String(handover.id),
    blid: handover.blid,
    occurredAt: handover.occurredAt.toISO() ?? "",
    from: toParty(handover.fromUserDetailId, lookups),
    to: toParty(handover.toUserDetailId, lookups),
  };
}

function toObligationDto(
  obligation: MatchObligation,
  bySenderHalf: Map<number, BookHandover>,
  byReceiverHalf: Map<number, BookHandover>,
  lookups: MatchLookups,
): MatchObligationDto {
  const senderHandover = bySenderHalf.get(obligation.id);
  const receiverHandover = byReceiverHalf.get(obligation.id);

  return {
    id: String(obligation.id),
    itemId: obligation.itemId,
    // Same fallback the statistics use: a deleted item must not render as a blank row.
    title: lookups.titles.get(obligation.itemId) ?? "Ukjent bok",
    sender: toParty(obligation.sender.userDetailId, lookups),
    receiver: toParty(obligation.receiver.userDetailId, lookups),
    senderHandover: senderHandover ? toHandoverDto(senderHandover, lookups) : null,
    receiverHandover: receiverHandover ? toHandoverDto(receiverHandover, lookups) : null,
  };
}

/**
 * Shapes matches for the API.
 *
 * Unlike the other transformers this is a plain function rather than a `BaseTransformer` subclass,
 * because rendering a match needs cross-record context (the handovers, and Mongo-side names and
 * titles) that the single-resource `toObject()` shape cannot carry.
 *
 * @param matches with `participants` and `obligations.sender`/`.receiver` preloaded
 * @param handovers every handover discharging a half of those obligations
 */
export function toMatchDtos(
  matches: Match[],
  handovers: BookHandover[],
  lookups: MatchLookups,
): MatchDto[] {
  const { bySenderHalf, byReceiverHalf } = indexHandoversByHalf(handovers);

  return matches.map((match) => ({
    id: String(match.id),
    roundId: String(match.roundId),
    // Derived, never stored: a stand match is one whose counterparty is the stand.
    isStandMatch: match.participants.some((participant) => participant.isStand),
    meetingLocation: match.meetingLocation,
    meetingTime: match.meetingTime?.toISO() ?? null,
    participants: match.participants.map((participant) =>
      toParty(participant.userDetailId, lookups),
    ),
    obligations: match.obligations.map((obligation) =>
      toObligationDto(obligation, bySenderHalf, byReceiverHalf, lookups),
    ),
  }));
}
