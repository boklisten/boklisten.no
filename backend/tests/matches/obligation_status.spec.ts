import { test } from "@japa/runner";
import { expect } from "chai";

import {
  deriveObligationProgress,
  dischargesSenderHalf,
  satisfiesReceiverHalf,
} from "#services/matches/obligation_status";

const S = "5d765db5fc8c47001c408d81"; // expected sender
const R = "5d765db5fc8c47001c408d82"; // expected receiver
const C = "5d765db5fc8c47001c408d83"; // an unrelated third student

const ITEM_X = "5d765db5fc8c47001c408e01";
const OTHER_ITEM = "5d765db5fc8c47001c408e02";
/** Two ids in the same hardcoded equivalence group in shared/item-equivalence.ts. */
const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";

/** S owes R a copy of item X. */
const obligation = { senderCustomerId: S, receiverCustomerId: R, itemId: ITEM_X };
/** The stand owes R a copy of item X. */
const standObligation = { senderCustomerId: null, receiverCustomerId: R, itemId: ITEM_X };

test.group("dischargesSenderHalf", () => {
  test("a book belonging to the sender discharges their obligation", () => {
    expect(dischargesSenderHalf(obligation, S, ITEM_X)).to.equal(true);
  });

  test("either of the sender's two copies discharges it", () => {
    // The Gymnos case: a student who received next year's copy before parting with their own
    // holds two, and handing over either must credit them. Nothing here depends on which.
    expect(dischargesSenderHalf(obligation, S, ITEM_X)).to.equal(true);
  });

  test("a book belonging to someone else does not", () => {
    expect(dischargesSenderHalf(obligation, C, ITEM_X)).to.equal(false);
  });

  test("a different title does not", () => {
    expect(dischargesSenderHalf(obligation, S, OTHER_ITEM)).to.equal(false);
  });

  test("an equivalent edition counts as the same title", () => {
    const gymnos = { senderCustomerId: S, receiverCustomerId: R, itemId: GYMNOS_2009 };
    expect(dischargesSenderHalf(gymnos, S, GYMNOS_2012)).to.equal(true);
  });

  test("a stand-sourced obligation has no sender to credit", () => {
    expect(dischargesSenderHalf(standObligation, null, ITEM_X)).to.equal(false);
  });
});

test.group("satisfiesReceiverHalf", () => {
  test("any copy of the title from anyone satisfies the receiver", () => {
    expect(satisfiesReceiverHalf(obligation, R, ITEM_X)).to.equal(true);
  });

  test("a different title does not", () => {
    expect(satisfiesReceiverHalf(obligation, R, OTHER_ITEM)).to.equal(false);
  });

  test("an equivalent edition does", () => {
    const gymnos = { senderCustomerId: S, receiverCustomerId: R, itemId: GYMNOS_2009 };
    expect(satisfiesReceiverHalf(gymnos, R, GYMNOS_2012)).to.equal(true);
  });
});

test.group("deriveObligationProgress", () => {
  test("case 1: pending when nothing has happened", () => {
    const progress = deriveObligationProgress(obligation, null, null);
    expect(progress.senderDischarged).to.equal(false);
    expect(progress.receiverSatisfied).to.equal(false);
    expect(progress.wentAsPlanned).to.equal(false);
    expect(progress.receivedFrom).to.equal(null);
    expect(progress.deliveredTo).to.equal(null);
  });

  test("case 2: as planned when one handover discharges both halves", () => {
    const handover = { id: 1, fromCustomerId: S, toCustomerId: R };
    const progress = deriveObligationProgress(obligation, handover, handover);
    expect(progress.wentAsPlanned).to.equal(true);
    expect(progress.receivedFrom).to.equal(null);
    expect(progress.deliveredTo).to.equal(null);
  });

  test("case 3: a second copy the sender owns is as good as their first", () => {
    // Receiving next year's copy and passing it on still credits the sender: it was theirs.
    const handover = { id: 2, fromCustomerId: S, toCustomerId: R };
    const progress = deriveObligationProgress(obligation, handover, handover);
    expect(progress.wentAsPlanned).to.equal(true);
    expect(progress.senderDischarged).to.equal(true);
    expect(progress.receivedFrom).to.equal(null);
  });

  test("case 4: names the actual sender when the book came from someone else", () => {
    const fromC = { id: 3, fromCustomerId: C, toCustomerId: R };
    const progress = deriveObligationProgress(obligation, null, fromC);
    expect(progress.receiverSatisfied).to.equal(true);
    expect(progress.senderDischarged).to.equal(false);
    expect(progress.wentAsPlanned).to.equal(false);
    expect(progress.receivedFrom).to.deep.equal({ kind: "customer", customerId: C });
  });

  test("case 6: the sender's copy went elsewhere and the receiver is still waiting", () => {
    // We report only what was recorded. Whether R will still get a book is unknowable: S may be
    // holding somebody else's copy that no scan ever captured, so nothing here guesses at it.
    const toC = { id: 5, fromCustomerId: S, toCustomerId: C };
    const progress = deriveObligationProgress(obligation, toC, null);
    expect(progress.senderDischarged).to.equal(true);
    expect(progress.deliveredTo).to.deep.equal({ kind: "customer", customerId: C });
    expect(progress.receiverSatisfied).to.equal(false);
  });

  test("case 8: reports the stand as the origin of a pickup", () => {
    const fromStand = { id: 7, fromCustomerId: null, toCustomerId: R };
    const progress = deriveObligationProgress(obligation, null, fromStand);
    expect(progress.receivedFrom).to.deep.equal({ kind: "stand" });
    expect(progress.receiverSatisfied).to.equal(true);
  });

  test("case 9: reports the stand as the destination of a return", () => {
    const toStand = { id: 8, fromCustomerId: S, toCustomerId: null };
    const progress = deriveObligationProgress(obligation, toStand, null);
    expect(progress.deliveredTo).to.deep.equal({ kind: "stand" });
    expect(progress.senderDischarged).to.equal(true);
  });

  test("case 10: both halves discharged by two different handovers", () => {
    const senderGaveToC = { id: 9, fromCustomerId: S, toCustomerId: C };
    const receiverGotFromC = { id: 10, fromCustomerId: C, toCustomerId: R };
    const progress = deriveObligationProgress(obligation, senderGaveToC, receiverGotFromC);
    expect(progress.wentAsPlanned).to.equal(false);
    expect(progress.deliveredTo).to.deep.equal({ kind: "customer", customerId: C });
    expect(progress.receivedFrom).to.deep.equal({ kind: "customer", customerId: C });
  });

  test("nothing is inferred about a pending obligation beyond it being pending", () => {
    const progress = deriveObligationProgress(obligation, null, null);
    expect(Object.values(progress)).to.deep.equal([false, false, false, null, null]);
  });
});
