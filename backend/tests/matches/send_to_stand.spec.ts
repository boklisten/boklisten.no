import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import BookHandover from "#models/book_handover";
import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import MatchRound from "#models/match_round";
import { createTestRound } from "#tests/matches/match-testing-utils";
import { sendMatchToStand } from "#services/matches/send_to_stand";

const PETTER = "5d765db5fc8c47001c408d81";
const MAYA = "5d765db5fc8c47001c408d82";
const ITEM_X = "5d765db5fc8c47001c408e01";
const ITEM_Y = "5d765db5fc8c47001c408e02";
const BLID = "BL0001234567";

function standParticipant(match: Match): MatchParticipant {
  return match.participants.find((participant) => participant.userDetailId === null)!;
}

function customerParticipant(match: Match): MatchParticipant {
  return match.participants.find((participant) => participant.userDetailId !== null)!;
}

test.group("sendMatchToStand", (group) => {
  let round: MatchRound;

  // `truncate()` returns the cleanup hook, so this empties the tables after each test.
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    round = await createTestRound({ name: "Round", standLocation: "Kantina", status: "active" });
  });

  interface SeededMatch {
    match: Match;
    sender: MatchParticipant;
    receiver: MatchParticipant;
    obligations: MatchObligation[];
  }

  /** A user match where `senderId` owes `receiverId` every listed item. */
  async function seedUserMatch(
    senderId: string,
    receiverId: string,
    itemIds: string[] = [ITEM_X],
  ): Promise<SeededMatch> {
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const [sender, receiver] = await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: senderId },
      { matchId: match.id, userDetailId: receiverId },
    ]);
    const obligations = await MatchObligation.createMany(
      itemIds.map((itemId) => ({
        matchId: match.id,
        senderParticipantId: sender!.id,
        receiverParticipantId: receiver!.id,
        itemId,
      })),
    );
    return { match, sender: sender!, receiver: receiver!, obligations };
  }

  /** An empty stand match for one customer, as the round generator would have made it. */
  async function seedStandMatch(customerId: string): Promise<Match> {
    const match = await Match.create({ roundId: round.id, meetingLocation: "Kantina" });
    await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: customerId },
      { matchId: match.id, userDetailId: null },
    ]);
    return match;
  }

  /** The customer's stand match in the round, with participants and obligations loaded. */
  async function findStandMatch(customerId: string): Promise<Match | null> {
    return Match.query()
      .where("roundId", round.id)
      .whereHas("participants", (participants) => participants.whereNull("userDetailId"))
      .whereHas("participants", (participants) => participants.where("userDetailId", customerId))
      .preload("participants")
      .preload("obligations")
      .first();
  }

  test("appends both halves of a pending obligation to existing stand matches", async ({
    assert,
  }) => {
    const { match } = await seedUserMatch(PETTER, MAYA);
    const petterStand = await seedStandMatch(PETTER);
    const mayaStand = await seedStandMatch(MAYA);

    await sendMatchToStand(match.id);

    assert.isNull(await Match.find(match.id));

    const petterObligations = await MatchObligation.query().where("matchId", petterStand.id);
    assert.lengthOf(petterObligations, 1);
    const petterStandLoaded = (await findStandMatch(PETTER))!;
    assert.equal(
      petterObligations[0]!.senderParticipantId,
      customerParticipant(petterStandLoaded).id,
    );
    assert.equal(
      petterObligations[0]!.receiverParticipantId,
      standParticipant(petterStandLoaded).id,
    );
    assert.equal(petterObligations[0]!.itemId, ITEM_X);

    const mayaObligations = await MatchObligation.query().where("matchId", mayaStand.id);
    assert.lengthOf(mayaObligations, 1);
    const mayaStandLoaded = (await findStandMatch(MAYA))!;
    assert.equal(mayaObligations[0]!.senderParticipantId, standParticipant(mayaStandLoaded).id);
    assert.equal(
      mayaObligations[0]!.receiverParticipantId,
      customerParticipant(mayaStandLoaded).id,
    );
    assert.equal(mayaObligations[0]!.itemId, ITEM_X);
  });

  test("creates a stand match at the round's stand when the customer has none", async ({
    assert,
  }) => {
    const { match } = await seedUserMatch(PETTER, MAYA, [ITEM_X, ITEM_Y]);

    await sendMatchToStand(match.id);

    const petterStand = await findStandMatch(PETTER);
    assert.isNotNull(petterStand);
    assert.equal(petterStand!.meetingLocation, "Kantina");
    assert.isNull(petterStand!.meetingTime);
    assert.lengthOf(petterStand!.participants, 2);
    assert.lengthOf(petterStand!.obligations, 2);

    const mayaStand = await findStandMatch(MAYA);
    assert.isNotNull(mayaStand);
    assert.lengthOf(mayaStand!.obligations, 2);
  });

  test("re-points a discharging handover so the delivered half stays settled", async ({
    assert,
  }) => {
    // Petter has already given Maya one of the two books; the other keeps the match unfinished.
    const { match, obligations } = await seedUserMatch(PETTER, MAYA, [ITEM_X, ITEM_Y]);
    const handover = await BookHandover.create({
      blid: BLID,
      itemId: ITEM_X,
      fromUserDetailId: PETTER,
      toUserDetailId: MAYA,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: obligations[0]!.id,
      dischargesReceiverObligationId: obligations[0]!.id,
    });

    await sendMatchToStand(match.id);

    const petterStand = (await findStandMatch(PETTER))!;
    const mayaStand = (await findStandMatch(MAYA))!;
    assert.lengthOf(petterStand.obligations, 2);
    assert.lengthOf(mayaStand.obligations, 2);
    const petterDelivered = petterStand.obligations.find((o) => o.itemId === ITEM_X)!;
    const mayaReceived = mayaStand.obligations.find((o) => o.itemId === ITEM_X)!;

    await handover.refresh();
    // The handover still names Petter and Maya, so Maya's stand match shows she got Petter's book.
    assert.equal(handover.dischargesSenderObligationId, petterDelivered.id);
    assert.equal(handover.dischargesReceiverObligationId, mayaReceived.id);
    assert.equal(handover.fromUserDetailId, PETTER);
    assert.equal(handover.toUserDetailId, MAYA);
  });

  test("carries a half-delivered obligation as one settled and one pending half", async ({
    assert,
  }) => {
    // Petter handed his copy to the stand earlier: his sender half is settled, Maya still waits.
    const { match, obligations } = await seedUserMatch(PETTER, MAYA);
    const handover = await BookHandover.create({
      blid: BLID,
      itemId: ITEM_X,
      fromUserDetailId: PETTER,
      toUserDetailId: null,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: obligations[0]!.id,
      dischargesReceiverObligationId: null,
    });

    await sendMatchToStand(match.id);

    const petterStand = (await findStandMatch(PETTER))!;
    const mayaStand = (await findStandMatch(MAYA))!;

    await handover.refresh();
    assert.equal(handover.dischargesSenderObligationId, petterStand.obligations[0]!.id);
    assert.isNull(handover.dischargesReceiverObligationId);

    // Maya's half exists and is still open for the stand to settle.
    assert.lengthOf(mayaStand.obligations, 1);
    const discharging = await BookHandover.query().where(
      "dischargesReceiverObligationId",
      mayaStand.obligations[0]!.id,
    );
    assert.lengthOf(discharging, 0);
  });

  test("refuses a stand match", async ({ assert }) => {
    const standMatch = await seedStandMatch(PETTER);

    await assert.rejects(() => sendMatchToStand(standMatch.id), /allerede en standoverlevering/);
    assert.isNotNull(await Match.find(standMatch.id));
  });

  test("refuses a fully completed match", async ({ assert }) => {
    const { match, obligations } = await seedUserMatch(PETTER, MAYA);
    await BookHandover.create({
      blid: BLID,
      itemId: ITEM_X,
      fromUserDetailId: PETTER,
      toUserDetailId: MAYA,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: obligations[0]!.id,
      dischargesReceiverObligationId: obligations[0]!.id,
    });

    await assert.rejects(() => sendMatchToStand(match.id), /allerede fullført/);
    assert.isNotNull(await Match.find(match.id));
  });

  test("refuses an unknown match id", async ({ assert }) => {
    await assert.rejects(() => sendMatchToStand(999_999), /finnes ikke/);
  });
});
