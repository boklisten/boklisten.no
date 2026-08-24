import { test } from "@japa/runner";

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
  test("a book belonging to the sender discharges their obligation", ({ assert }) => {
    // Covers the Gymnos case too: a student who received next year's copy before parting with
    // their own holds two, and handing over either must credit them — the check only looks at
    // owner and title, so which copy it is never matters.
    assert.equal(dischargesSenderHalf(obligation, S, ITEM_X), true);
  });

  test("a book belonging to someone else does not", ({ assert }) => {
    assert.equal(dischargesSenderHalf(obligation, C, ITEM_X), false);
  });

  test("a different title does not", ({ assert }) => {
    assert.equal(dischargesSenderHalf(obligation, S, OTHER_ITEM), false);
  });

  test("an equivalent edition counts as the same title", ({ assert }) => {
    const gymnos = { senderCustomerId: S, receiverCustomerId: R, itemId: GYMNOS_2009 };
    assert.equal(dischargesSenderHalf(gymnos, S, GYMNOS_2012), true);
  });

  test("a stand-sourced obligation has no sender to credit", ({ assert }) => {
    assert.equal(dischargesSenderHalf(standObligation, null, ITEM_X), false);
  });
});

test.group("satisfiesReceiverHalf", () => {
  test("any copy of the title from anyone satisfies the receiver", ({ assert }) => {
    assert.equal(satisfiesReceiverHalf(obligation, R, ITEM_X), true);
  });

  test("a different title does not", ({ assert }) => {
    assert.equal(satisfiesReceiverHalf(obligation, R, OTHER_ITEM), false);
  });

  test("an equivalent edition does", ({ assert }) => {
    const gymnos = { senderCustomerId: S, receiverCustomerId: R, itemId: GYMNOS_2009 };
    assert.equal(satisfiesReceiverHalf(gymnos, R, GYMNOS_2012), true);
  });
});

test.group("deriveObligationProgress", () => {
  test("case 1: pending when nothing has happened", ({ assert }) => {
    const progress = deriveObligationProgress(obligation, null, null);
    assert.equal(progress.senderDischarged, false);
    assert.equal(progress.receiverSatisfied, false);
    assert.equal(progress.wentAsPlanned, false);
    assert.equal(progress.receivedFrom, null);
    assert.equal(progress.deliveredTo, null);
  });

  test("case 2: as planned when one handover discharges both halves", ({ assert }) => {
    const handover = { id: 1, fromCustomerId: S, toCustomerId: R };
    const progress = deriveObligationProgress(obligation, handover, handover);
    assert.equal(progress.wentAsPlanned, true);
    assert.equal(progress.receivedFrom, null);
    assert.equal(progress.deliveredTo, null);
  });

  test("case 3: a second copy the sender owns is as good as their first", ({ assert }) => {
    // Receiving next year's copy and passing it on still credits the sender: it was theirs.
    const handover = { id: 2, fromCustomerId: S, toCustomerId: R };
    const progress = deriveObligationProgress(obligation, handover, handover);
    assert.equal(progress.wentAsPlanned, true);
    assert.equal(progress.senderDischarged, true);
    assert.equal(progress.receivedFrom, null);
  });

  test("case 4: names the actual sender when the book came from someone else", ({ assert }) => {
    const fromC = { id: 3, fromCustomerId: C, toCustomerId: R };
    const progress = deriveObligationProgress(obligation, null, fromC);
    assert.equal(progress.receiverSatisfied, true);
    assert.equal(progress.senderDischarged, false);
    assert.equal(progress.wentAsPlanned, false);
    assert.deepEqual(progress.receivedFrom, { kind: "customer", customerId: C });
  });

  test("case 6: the sender's copy went elsewhere and the receiver is still waiting", ({
    assert,
  }) => {
    // We report only what was recorded. Whether R will still get a book is unknowable: S may be
    // holding somebody else's copy that no scan ever captured, so nothing here guesses at it.
    const toC = { id: 5, fromCustomerId: S, toCustomerId: C };
    const progress = deriveObligationProgress(obligation, toC, null);
    assert.equal(progress.senderDischarged, true);
    assert.deepEqual(progress.deliveredTo, { kind: "customer", customerId: C });
    assert.equal(progress.receiverSatisfied, false);
  });

  test("case 8: reports the stand as the origin of a pickup", ({ assert }) => {
    const fromStand = { id: 7, fromCustomerId: null, toCustomerId: R };
    const progress = deriveObligationProgress(obligation, null, fromStand);
    assert.deepEqual(progress.receivedFrom, { kind: "stand" });
    assert.equal(progress.receiverSatisfied, true);
  });

  test("case 9: reports the stand as the destination of a return", ({ assert }) => {
    const toStand = { id: 8, fromCustomerId: S, toCustomerId: null };
    const progress = deriveObligationProgress(obligation, toStand, null);
    assert.deepEqual(progress.deliveredTo, { kind: "stand" });
    assert.equal(progress.senderDischarged, true);
  });

  test("case 10: both halves discharged by two different handovers", ({ assert }) => {
    const senderGaveToC = { id: 9, fromCustomerId: S, toCustomerId: C };
    const receiverGotFromC = { id: 10, fromCustomerId: C, toCustomerId: R };
    const progress = deriveObligationProgress(obligation, senderGaveToC, receiverGotFromC);
    assert.equal(progress.wentAsPlanned, false);
    assert.deepEqual(progress.deliveredTo, { kind: "customer", customerId: C });
    assert.deepEqual(progress.receivedFrom, { kind: "customer", customerId: C });
  });

  test("nothing is inferred about a pending obligation beyond it being pending", ({ assert }) => {
    const progress = deriveObligationProgress(obligation, null, null);
    assert.deepEqual(Object.values(progress), [false, false, false, null, null]);
  });
});
