import { itemsAreEquivalent } from "#shared/item-equivalence";

/**
 * A party to a handover. The stand is a real party, not a missing customer —
 * `null` customer ids from the database are normalised into `{ kind: "stand" }`.
 */
export type PartyRef = { kind: "stand" } | { kind: "customer"; customerId: string };

export interface HandoverFacts {
  id: number;
  /** null means the stand. */
  fromCustomerId: string | null;
  /** null means the stand. */
  toCustomerId: string | null;
}

/** The discharge stamps a recorded handover carries — the only fields half-indexing needs. */
export interface DischargeStamps {
  dischargesSenderObligationId: number | null;
  dischargesReceiverObligationId: number | null;
}

/**
 * Index handovers by which obligation half each discharged. The partial unique indexes guarantee
 * at most one handover per half, so a plain Map loses nothing.
 */
export function indexHandoversByHalf<T extends DischargeStamps>(
  handovers: T[],
): { bySenderHalf: Map<number, T>; byReceiverHalf: Map<number, T> } {
  const bySenderHalf = new Map<number, T>();
  const byReceiverHalf = new Map<number, T>();
  for (const handover of handovers) {
    if (handover.dischargesSenderObligationId !== null) {
      bySenderHalf.set(handover.dischargesSenderObligationId, handover);
    }
    if (handover.dischargesReceiverObligationId !== null) {
      byReceiverHalf.set(handover.dischargesReceiverObligationId, handover);
    }
  }
  return { bySenderHalf, byReceiverHalf };
}

/**
 * The subset of a `MatchObligation` that attribution depends on.
 *
 * Credit follows **ownership**, not a particular copy. A book that was given to a student belongs
 * to that student, so someone holding two copies of a title discharges this obligation with either
 * of them — the common case when a student receives next year's copy before parting with their own.
 * What separates the cases is *whose* book moved, which the handover records directly.
 */
export interface ObligationFacts {
  /** null means the stand. */
  senderCustomerId: string | null;
  /** null means the stand. */
  receiverCustomerId: string | null;
  /** The title owed. Equivalent editions count as the same title. */
  itemId: string;
}

/**
 * Whether a handover discharges the sender half of this obligation.
 *
 * Ownership follows possession — `CustomerItemActiveBlid` resolves a blid to its currently active
 * `CustomerItem`, and both peer transfers and stand returns move that record to the new holder. So
 * the party handing a book over is always the party responsible for it, and the only questions left
 * are whether they are this obligation's sender and whether the title matches.
 *
 * Deliberately not keyed on a particular copy: a student holding two copies must get credit for
 * handing over either, and binding one at generation time would make delivering the other credit
 * nobody.
 */
export function dischargesSenderHalf(
  obligation: ObligationFacts,
  fromCustomerId: string | null,
  itemId: string,
): boolean {
  return (
    obligation.senderCustomerId !== null &&
    obligation.senderCustomerId === fromCustomerId &&
    itemsAreEquivalent(obligation.itemId, itemId)
  );
}

/**
 * Whether a handover satisfies the receiver half of this obligation. Any copy of the title will do,
 * whoever it came from.
 */
export function satisfiesReceiverHalf(
  obligation: ObligationFacts,
  toCustomerId: string | null,
  itemId: string,
): boolean {
  return (
    obligation.receiverCustomerId !== null &&
    obligation.receiverCustomerId === toCustomerId &&
    itemsAreEquivalent(obligation.itemId, itemId)
  );
}

export interface ObligationProgress {
  /**
   * A book belonging to the sender has been delivered to someone, so they are no longer on the hook
   * for it. False while they still hold every copy they owe.
   */
  senderDischarged: boolean;
  /** The receiver has been given a copy of the title by someone — any copy will do. */
  receiverSatisfied: boolean;
  /** Both halves were discharged by the same physical handover. */
  wentAsPlanned: boolean;
  /** Set when the receiver got the book from someone other than the expected sender. */
  receivedFrom: PartyRef | null;
  /** Set when the sender gave a copy to someone other than the expected receiver. */
  deliveredTo: PartyRef | null;
}

function toParty(customerId: string | null): PartyRef {
  return customerId === null ? { kind: "stand" } : { kind: "customer", customerId };
}

/**
 * Turns an obligation and the (up to two, possibly different) handovers that discharged its halves
 * into the facts the UI needs.
 *
 * Both halves can be discharged by different events: when a student receives a book from someone
 * other than the peer they were matched with, the receiver's half and the expected sender's half
 * come apart, and each party needs to be told something different.
 *
 * Every field returned here reads a recorded event. Nothing is inferred about what a student
 * physically holds, because nothing can be.
 *
 * @param obligation who owes what to whom, and which copy the sender is responsible for
 * @param senderHandover the delivery of the sender's own copy, if it has happened
 * @param receiverHandover the delivery that satisfied the receiver, if it has happened
 */
export function deriveObligationProgress(
  obligation: ObligationFacts,
  senderHandover: HandoverFacts | null,
  receiverHandover: HandoverFacts | null,
): ObligationProgress {
  const wentAsPlanned =
    senderHandover !== null &&
    receiverHandover !== null &&
    senderHandover.id === receiverHandover.id;

  const receivedFrom =
    receiverHandover !== null && receiverHandover.fromCustomerId !== obligation.senderCustomerId
      ? toParty(receiverHandover.fromCustomerId)
      : null;

  const deliveredTo =
    senderHandover !== null && senderHandover.toCustomerId !== obligation.receiverCustomerId
      ? toParty(senderHandover.toCustomerId)
      : null;

  return {
    senderDischarged: senderHandover !== null,
    receiverSatisfied: receiverHandover !== null,
    wentAsPlanned,
    receivedFrom,
    deliveredTo,
  };
}
