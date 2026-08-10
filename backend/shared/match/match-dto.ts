/**
 * A party to a handover. The stand is a party in its own right, not a missing customer, so callers
 * never have to treat `null` as "somehow the stand".
 */
export type HandoverParty =
  | { kind: "stand" }
  | { kind: "customer"; customerId: string; name: string; phone: string; email: string };

/** A book that actually changed hands. */
export interface HandoverDto {
  id: string;
  /** null for legacy copies that never got a blid. */
  blid: string | null;
  /** ISO timestamp. */
  occurredAt: string;
  from: HandoverParty;
  to: HandoverParty;
}

/**
 * One book that should move between two parties.
 *
 * The two sides are asymmetric on purpose: `senderHandover` is set when a copy that *belonged to
 * the sender* was delivered — to anyone — while `receiverHandover` is set by any copy of the title
 * reaching the receiver, from anyone. They can therefore be two different events, which is exactly
 * the case the old model could not represent and the reason each party is told something different.
 */
export interface MatchObligationDto {
  id: string;
  itemId: string;
  title: string;
  /** The party expected to hand the book over. */
  sender: HandoverParty;
  /** The party expected to receive it. */
  receiver: HandoverParty;
  /** When true, this book may not be handed in at the stand — it must go to the other student. */
  lockedToMatch: boolean;
  /** The delivery of one of the sender's own copies, if it has happened. */
  senderHandover: HandoverDto | null;
  /** The delivery that satisfied the receiver, if it has happened. */
  receiverHandover: HandoverDto | null;
}

export interface MatchDto {
  id: string;
  roundId: string;
  /** Derived from the parties, not stored: a stand match is one whose counterparty is the stand. */
  isStandMatch: boolean;
  meetingLocation: string;
  /** ISO timestamp, or null when no time has been set. */
  meetingTime: string | null;
  /** Exactly two; one may be the stand. */
  participants: HandoverParty[];
  obligations: MatchObligationDto[];
}

/*
 * Deliberately absent: any status enum, and any signal about whether a pending obligation will ever
 * be fulfilled. Status is derived from the two handovers by the consumer; predicting the future
 * would mean claiming to know what a student is physically holding, which we never do.
 */
