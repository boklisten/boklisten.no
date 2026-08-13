import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import sinon from "sinon";
import { DateTime } from "luxon";

import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import MatchRound from "#models/match_round";
import { createTestRound } from "#tests/matches/match-testing-utils";
import { MatchLock } from "#services/matches/match_lock";
import { MatchRepository } from "#services/matches/match_repository";

const A = "5d765db5fc8c47001c408d81";
const B = "5d765db5fc8c47001c408d82";
const C = "5d765db5fc8c47001c408d83";
const ITEM_X = "5d765db5fc8c47001c408e01";
const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";

test.group("MatchLock", (group) => {
  let round: MatchRound;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    // Explicitly active: a round is born a draft, and a draft's locks are inert by design.
    round = await createTestRound({ name: "Round", standLocation: "Kantina", status: "active" });
  });

  async function seedObligation(
    senderId: string | null,
    receiverId: string | null,
    options: { itemId?: string; lockedToMatch?: boolean; roundId?: number } = {},
  ): Promise<MatchObligation> {
    const match = await Match.create({
      roundId: options.roundId ?? round.id,
      meetingLocation: "Biblioteket",
    });
    const [sender, receiver] = await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: senderId },
      { matchId: match.id, userDetailId: receiverId },
    ]);
    return MatchObligation.create({
      matchId: match.id,
      senderParticipantId: sender!.id,
      receiverParticipantId: receiver!.id,
      itemId: options.itemId ?? ITEM_X,
      lockedToMatch: options.lockedToMatch ?? true,
    });
  }

  async function dischargeSender(obligation: MatchObligation) {
    await MatchRepository.recordHandover({
      blid: "BL0001234567",
      itemId: obligation.itemId,
      fromUserDetailId: A,
      toUserDetailId: B,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: obligation.id,
      dischargesReceiverObligationId: null,
    });
  }

  test("a book owed to a peer may not be handed in at the stand", async ({ assert }) => {
    await seedObligation(A, B);

    const locked = await MatchLock.findCustomerItemsLockedToMatch([
      { customer: A, item: ITEM_X },
      { customer: C, item: ITEM_X },
    ]);

    assert.deepEqual(locked, [{ customer: A, item: ITEM_X }]);
  });

  test("a book due back at the stand is not locked", async ({ assert }) => {
    await seedObligation(A, null, { lockedToMatch: false });

    assert.isEmpty(await MatchLock.findCustomerItemsLockedToMatch([{ customer: A, item: ITEM_X }]));
  });

  test("the lock lifts once the book has actually been handed over", async ({ assert }) => {
    // Otherwise a delivered book stays unreturnable for the rest of its life.
    const obligation = await seedObligation(A, B);
    await dischargeSender(obligation);

    assert.isEmpty(await MatchLock.findCustomerItemsLockedToMatch([{ customer: A, item: ITEM_X }]));
  });

  test("a draft round locks nothing", async ({ assert }) => {
    const old = await createTestRound({
      name: "Last term",
      standLocation: "Kantina",
      status: "draft",
    });
    await seedObligation(A, B, { roundId: old.id });

    assert.isEmpty(await MatchLock.findCustomerItemsLockedToMatch([{ customer: A, item: ITEM_X }]));
  });

  test("an equivalent edition of a locked title is locked too", async ({ assert }) => {
    await seedObligation(A, B, { itemId: GYMNOS_2009 });

    const locked = await MatchLock.findCustomerItemsLockedToMatch([
      { customer: A, item: GYMNOS_2012 },
    ]);

    assert.lengthOf(locked, 1);
  });

  test("one query however many books are checked", async ({ assert }) => {
    // The old in-memory version read every UserMatch in the database to answer this; the failure
    // mode to guard against now is a query per book.
    await seedObligation(A, B);
    const query = sinon.spy(MatchObligation, "query");

    try {
      await MatchLock.findCustomerItemsLockedToMatch(
        Array.from({ length: 20 }, () => ({ customer: A, item: ITEM_X })),
      );
    } finally {
      query.restore();
    }

    assert.equal(query.callCount, 1);
  });

  test("an item the customer must get from a peer is blocked at the stand", async ({ assert }) => {
    await seedObligation(A, B);

    assert.deepEqual(await MatchLock.findItemsLockedForReceiver([ITEM_X], B), [ITEM_X]);
    assert.isEmpty(await MatchLock.findItemsLockedForReceiver([ITEM_X], C));
  });

  test("names the peer a book is due from, and whether that is locked", async ({ assert }) => {
    await seedObligation(A, B, { lockedToMatch: false });

    assert.deepEqual(await MatchLock.findPeerSender(B, ITEM_X), {
      senderCustomerId: A,
      lockedToMatch: false,
    });
  });

  test("a stand pickup has no peer to name", async ({ assert }) => {
    await seedObligation(null, B, { lockedToMatch: false });

    assert.isNull(await MatchLock.findPeerSender(B, ITEM_X));
  });

  test("names the student a locked book must be given to", async ({ assert }) => {
    await seedObligation(A, B);

    assert.equal(await MatchLock.findLockedRecipient(A, ITEM_X), B);
    assert.isNull(await MatchLock.findLockedRecipient(B, ITEM_X));
  });

  test("locking a customer locks every obligation in their matches", async ({ assert }) => {
    const mine = await seedObligation(A, B, { lockedToMatch: false });
    const theirs = await seedObligation(B, A, { lockedToMatch: false });
    const unrelated = await seedObligation(B, C, { lockedToMatch: false });

    await MatchLock.setLockedForCustomer(A, true);

    await Promise.all([mine.refresh(), theirs.refresh(), unrelated.refresh()]);
    assert.isTrue(mine.lockedToMatch);
    assert.isTrue(theirs.lockedToMatch, "both directions of A's own match are locked");
    assert.isFalse(unrelated.lockedToMatch, "a match A is not part of is untouched");
  });

  test("unlocking a customer releases their matches", async ({ assert }) => {
    const mine = await seedObligation(A, B);

    await MatchLock.setLockedForCustomer(A, false);

    await mine.refresh();
    assert.isFalse(mine.lockedToMatch);
  });

  test("locking a customer leaves their stand match alone", async ({ assert }) => {
    const standObligation = await seedObligation(A, null, { lockedToMatch: false });

    await MatchLock.setLockedForCustomer(A, true);

    await standObligation.refresh();
    assert.isFalse(
      standObligation.lockedToMatch,
      "a lock says 'hand this to a student, not the stand' — meaningless for a stand match",
    );
  });

  test("locking a customer leaves draft rounds alone", async ({ assert }) => {
    const old = await createTestRound({
      name: "Old",
      standLocation: "Kantina",
      status: "draft",
    });
    const pastObligation = await seedObligation(A, B, { lockedToMatch: false, roundId: old.id });

    await MatchLock.setLockedForCustomer(A, true);

    await pastObligation.refresh();
    assert.isFalse(pastObligation.lockedToMatch);
  });
});
