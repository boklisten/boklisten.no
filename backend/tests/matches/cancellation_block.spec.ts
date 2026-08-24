import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import { createTestRound } from "#tests/matches/match-testing-utils";
import {
  assertNotBlockedByUserMatch,
  itemIdsInActiveUserMatches,
} from "#services/matches/cancellation_block";

const CUSTOMER = "5d765db5fc8c47001c408d81";
const PEER = "5d765db5fc8c47001c408d82";
const ITEM_X = "5d765db5fc8c47001c408e01";
const ITEM_Y = "5d765db5fc8c47001c408e02";

// A hardcoded equivalence group from #shared/item-equivalence
const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";

async function createUserMatch({
  roundId,
  sender,
  receiver,
  itemIds,
}: {
  roundId: number;
  sender: string;
  receiver: string;
  itemIds: string[];
}) {
  const match = await Match.create({ roundId, meetingLocation: "Biblioteket" });
  const [senderParticipant, receiverParticipant] = await MatchParticipant.createMany([
    { matchId: match.id, userDetailId: sender },
    { matchId: match.id, userDetailId: receiver },
  ]);
  await MatchObligation.createMany(
    itemIds.map((itemId) => ({
      matchId: match.id,
      itemId,
      senderParticipantId: senderParticipant!.id,
      receiverParticipantId: receiverParticipant!.id,
    })),
  );
  return match;
}

async function createStandMatch({
  roundId,
  customer,
  itemIds,
}: {
  roundId: number;
  customer: string;
  itemIds: string[];
}) {
  const match = await Match.create({ roundId, meetingLocation: "Kantina" });
  const [standParticipant, customerParticipant] = await MatchParticipant.createMany([
    { matchId: match.id, userDetailId: null },
    { matchId: match.id, userDetailId: customer },
  ]);
  await MatchObligation.createMany(
    itemIds.map((itemId) => ({
      matchId: match.id,
      itemId,
      senderParticipantId: standParticipant!.id,
      receiverParticipantId: customerParticipant!.id,
    })),
  );
  return match;
}

test.group("cancellation block: itemIdsInActiveUserMatches", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("includes items from the customer's user matches, both directions", async ({ assert }) => {
    const round = await createTestRound({ name: "Round", status: "active" });
    await createUserMatch({
      roundId: round.id,
      sender: PEER,
      receiver: CUSTOMER,
      itemIds: [ITEM_X],
    });
    await createUserMatch({
      roundId: round.id,
      sender: CUSTOMER,
      receiver: PEER,
      itemIds: [ITEM_Y],
    });

    const blocked = await itemIdsInActiveUserMatches(CUSTOMER);
    assert.isTrue(blocked.has(ITEM_X));
    assert.isTrue(blocked.has(ITEM_Y));
  });

  test("ignores stand matches", async ({ assert }) => {
    const round = await createTestRound({ name: "Round", status: "active" });
    await createStandMatch({ roundId: round.id, customer: CUSTOMER, itemIds: [ITEM_X] });

    const blocked = await itemIdsInActiveUserMatches(CUSTOMER);
    assert.isFalse(blocked.has(ITEM_X));
  });

  test("ignores matches in rounds that are not active", async ({ assert }) => {
    const round = await createTestRound({ name: "Draft round", status: "draft" });
    await createUserMatch({
      roundId: round.id,
      sender: PEER,
      receiver: CUSTOMER,
      itemIds: [ITEM_X],
    });

    const blocked = await itemIdsInActiveUserMatches(CUSTOMER);
    assert.isFalse(blocked.has(ITEM_X));
  });

  test("ignores other customers' matches", async ({ assert }) => {
    const round = await createTestRound({ name: "Round", status: "active" });
    const other = "5d765db5fc8c47001c408d83";
    await createUserMatch({ roundId: round.id, sender: PEER, receiver: other, itemIds: [ITEM_X] });

    const blocked = await itemIdsInActiveUserMatches(CUSTOMER);
    assert.isEmpty([...blocked]);
  });

  test("includes equivalent editions of a matched item", async ({ assert }) => {
    const round = await createTestRound({ name: "Round", status: "active" });
    await createUserMatch({
      roundId: round.id,
      sender: PEER,
      receiver: CUSTOMER,
      itemIds: [GYMNOS_2009],
    });

    const blocked = await itemIdsInActiveUserMatches(CUSTOMER);
    assert.isTrue(blocked.has(GYMNOS_2009));
    assert.isTrue(blocked.has(GYMNOS_2012));
  });
});

test.group("cancellation block: assertNotBlockedByUserMatch", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("throws for an item in one of the customer's user matches", async ({ assert }) => {
    const round = await createTestRound({ name: "Round", status: "active" });
    await createUserMatch({
      roundId: round.id,
      sender: PEER,
      receiver: CUSTOMER,
      itemIds: [ITEM_X],
    });

    await assert.rejects(
      () => assertNotBlockedByUserMatch(CUSTOMER, ITEM_X),
      "Boka er en del av en overlevering med en annen elev og kan ikke avbestilles",
    );
  });

  test("resolves for an item outside the customer's user matches", async () => {
    const round = await createTestRound({ name: "Round", status: "active" });
    await createUserMatch({
      roundId: round.id,
      sender: PEER,
      receiver: CUSTOMER,
      itemIds: [ITEM_X],
    });

    await assertNotBlockedByUserMatch(CUSTOMER, ITEM_Y);
  });
});
