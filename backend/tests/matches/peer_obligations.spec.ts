import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import type MatchRound from "#models/match_round";
import { createTestRound } from "#tests/matches/match-testing-utils";
import { PeerObligations } from "#services/matches/peer_obligations";
import { MatchRepository } from "#services/matches/match_repository";

const A = "5d765db5fc8c47001c408d81";
const B = "5d765db5fc8c47001c408d82";
const C = "5d765db5fc8c47001c408d83";
const ITEM_X = "5d765db5fc8c47001c408e01";
const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";

test.group("PeerObligations", (group) => {
  let round: MatchRound;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    // Explicitly active: a round is born a draft, and a draft's obligations are inert by design.
    round = await createTestRound({ name: "Round", standLocation: "Kantina", status: "active" });
  });

  async function seedObligation(
    senderId: string | null,
    receiverId: string | null,
    options: { itemId?: string; roundId?: number } = {},
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
    });
  }

  async function discharge(obligation: MatchObligation, half: "sender" | "receiver") {
    await MatchRepository.recordHandover({
      blid: "BL0001234567",
      itemId: obligation.itemId,
      fromUserDetailId: A,
      toUserDetailId: B,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: half === "sender" ? obligation.id : null,
      dischargesReceiverObligationId: half === "receiver" ? obligation.id : null,
    });
  }

  test("names the peer a book is due from", async ({ assert }) => {
    await seedObligation(A, B);

    assert.equal(await PeerObligations.findPeerSender(B, ITEM_X), A);
    assert.isNull(await PeerObligations.findPeerSender(C, ITEM_X));
  });

  test("a stand pickup has no peer sender to name", async ({ assert }) => {
    await seedObligation(null, B);

    assert.isNull(await PeerObligations.findPeerSender(B, ITEM_X));
  });

  test("no peer sender once the receiver has gotten their book", async ({ assert }) => {
    const obligation = await seedObligation(A, B);
    await discharge(obligation, "receiver");

    assert.isNull(await PeerObligations.findPeerSender(B, ITEM_X));
  });

  test("a draft round warns about nothing", async ({ assert }) => {
    const draft = await createTestRound({
      name: "Last term",
      standLocation: "Kantina",
      status: "draft",
    });
    await seedObligation(A, B, { roundId: draft.id });

    assert.isNull(await PeerObligations.findPeerSender(B, ITEM_X));
    assert.isNull(await PeerObligations.findPeerRecipient(A, ITEM_X));
  });

  test("an equivalent edition counts as the same title", async ({ assert }) => {
    await seedObligation(A, B, { itemId: GYMNOS_2009 });

    assert.equal(await PeerObligations.findPeerSender(B, GYMNOS_2012), A);
    assert.equal(await PeerObligations.findPeerRecipient(A, GYMNOS_2012), B);
  });

  test("names the student a held book is due to go to", async ({ assert }) => {
    await seedObligation(A, B);

    assert.equal(await PeerObligations.findPeerRecipient(A, ITEM_X), B);
    assert.isNull(await PeerObligations.findPeerRecipient(B, ITEM_X));
  });

  test("a stand return has no peer recipient to name", async ({ assert }) => {
    await seedObligation(A, null);

    assert.isNull(await PeerObligations.findPeerRecipient(A, ITEM_X));
  });

  test("no peer recipient once the sender's copy has moved", async ({ assert }) => {
    const obligation = await seedObligation(A, B);
    await discharge(obligation, "sender");

    assert.isNull(await PeerObligations.findPeerRecipient(A, ITEM_X));
  });

  test("a stand obligation does not shadow a peer obligation for the same title", async ({
    assert,
  }) => {
    // Oldest row first would be the stand half; the peer must still be found.
    await seedObligation(A, null);
    await seedObligation(A, B);

    assert.equal(await PeerObligations.findPeerRecipient(A, ITEM_X), B);
  });
});
