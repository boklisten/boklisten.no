/**
 * A party to a handover. The stand is a real party, not a missing customer —
 * `null` customer ids from the database are normalised into `{ kind: "stand" }`.
 */
type PartyRef = { kind: "stand" } | { kind: "customer"; customerId: string };

export interface HandoverFacts {
  id: number;
  /** null means the stand. */
  fromCustomerId: string | null;
  /** null means the stand. */
  toCustomerId: string | null;
}

/** The discharge stamps a recorded handover carries — the only fields half-indexing needs. */
interface DischargeStamps {
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
interface ObligationFacts {
  /** null means the stand. */
  senderCustomerId: string | null;
  /** null means the stand. */
  receiverCustomerId: string | null;
  /** The title owed. Equivalent editions count as the same title. */
  itemId: string;
}

interface ObligationProgress {
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
