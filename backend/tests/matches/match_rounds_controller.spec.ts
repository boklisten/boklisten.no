import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import BookHandover from "#models/book_handover";
import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import MatchRound from "#models/match_round";
import { MatchRepository } from "#services/matches/match_repository";
import { TEST_DEADLINE, createTestRound } from "#tests/matches/match-testing-utils";

test.group("match round management", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("lists rounds newest first", async ({ assert }) => {
    await createTestRound({ name: "Høst 2025", standLocation: "Kantina" });
    await createTestRound({ name: "Vår 2026", standLocation: "Biblioteket" });

    const rounds = await MatchRound.query().orderBy("id", "desc");

    assert.deepEqual(
      rounds.map((round) => round.name),
      ["Vår 2026", "Høst 2025"],
    );
  });

  test("renames a round", async ({ assert }) => {
    const round = await createTestRound({ name: "Feilstavet", standLocation: "Kantina" });

    await round.merge({ name: "Ullern Vår 2026" }).save();

    assert.equal((await MatchRound.findOrFail(round.id)).name, "Ullern Vår 2026");
  });

  test("switches a round off again", async ({ assert }) => {
    const round = await createTestRound({
      name: "Ferdig",
      standLocation: "Kantina",
      status: "active",
    });

    await round.merge({ status: "draft" }).save();

    assert.equal((await MatchRound.findOrFail(round.id)).status, "draft");
  });

  test("deleting a round takes its matches, participants and obligations with it, but keeps handover history", async ({
    assert,
  }) => {
    const round = await createTestRound({ name: "Slettes", standLocation: "Kantina" });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const sender = await MatchParticipant.create({
      matchId: match.id,
      userDetailId: "5d765db5fc8c47001c408d81",
    });
    const receiver = await MatchParticipant.create({
      matchId: match.id,
      userDetailId: "5d765db5fc8c47001c408d82",
    });
    const obligation = await MatchObligation.create({
      matchId: match.id,
      senderParticipantId: sender.id,
      receiverParticipantId: receiver.id,
      itemId: "5b6441c4d2e733002fae89a6",
    });
    const handover = await BookHandover.create({
      blid: "BL0001234567",
      itemId: "5b6441c4d2e733002fae89a6",
      fromUserDetailId: "5d765db5fc8c47001c408d81",
      toUserDetailId: "5d765db5fc8c47001c408d82",
      occurredAt: DateTime.now(),
      dischargesSenderObligationId: obligation.id,
    });

    await round.delete();

    assert.isNull(await MatchRound.find(round.id));
    assert.isNull(await Match.find(match.id));
    assert.isNull(await MatchParticipant.find(sender.id));
    assert.isNull(await MatchObligation.find(obligation.id));

    // The physical transfer happened; deleting the round must not rewrite history.
    const survivingHandover = await BookHandover.findOrFail(handover.id);
    assert.isNull(survivingHandover.dischargesSenderObligationId);
  });

  test("an unknown status never reaches the database", async ({ assert }) => {
    // The validator is the first line of defence; the check constraint from Plan 1 is the second.
    const { matchRoundPatchValidator } = await import("#validators/matches");

    for (const status of ["ferdig", "archived"]) {
      await matchRoundPatchValidator.validate({ status }).then(
        () => {
          throw new Error(`expected the validator to reject the status '${status}'`);
        },
        () => undefined,
      );
    }

    assert.isTrue(true);
  });

  test("accepts a rename without a status and vice versa", async ({ assert }) => {
    const { matchRoundPatchValidator } = await import("#validators/matches");

    assert.deepEqual(await matchRoundPatchValidator.validate({ name: "Bare navn" }), {
      name: "Bare navn",
    });
    assert.deepEqual(await matchRoundPatchValidator.validate({ status: "active" }), {
      status: "active",
    });
  });

  test("deleting the matches returns the round to its planned state, plan intact", async ({
    assert,
  }) => {
    const round = await createTestRound({
      name: "Angrer",
      status: "active",
      generatedAt: DateTime.now(),
      userMatchLocations: ["Biblioteket", "Aulaen"],
    });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    await MatchParticipant.create({ matchId: match.id, userDetailId: "5d765db5fc8c47001c408d81" });

    await MatchRepository.deleteMatches(round.id);

    assert.isEmpty(await Match.query().where("roundId", round.id));

    const planned = await MatchRound.findOrFail(round.id);
    assert.isNull(planned.generatedAt, "the round is planned again");
    assert.equal(planned.status, "draft", "an emptied round must not stay visible to students");
    // The point of keeping the plan is that the round can be generated again from it.
    assert.deepEqual(planned.userMatchLocations, ["Biblioteket", "Aulaen"]);
    assert.equal(planned.deadline.toISODate(), TEST_DEADLINE.toISODate());
  });

  test("deleting the matches keeps the handovers that already happened", async ({ assert }) => {
    const round = await createTestRound({ name: "Halvveis", generatedAt: DateTime.now() });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const sender = await MatchParticipant.create({
      matchId: match.id,
      userDetailId: "5d765db5fc8c47001c408d81",
    });
    const receiver = await MatchParticipant.create({
      matchId: match.id,
      userDetailId: "5d765db5fc8c47001c408d82",
    });
    const obligation = await MatchObligation.create({
      matchId: match.id,
      senderParticipantId: sender.id,
      receiverParticipantId: receiver.id,
      itemId: "5b6441c4d2e733002fae89a6",
    });
    const handover = await BookHandover.create({
      blid: "BL0001234567",
      itemId: "5b6441c4d2e733002fae89a6",
      fromUserDetailId: "5d765db5fc8c47001c408d81",
      toUserDetailId: "5d765db5fc8c47001c408d82",
      occurredAt: DateTime.now(),
      dischargesSenderObligationId: obligation.id,
    });

    await MatchRepository.deleteMatches(round.id);

    const survivor = await BookHandover.findOrFail(handover.id);
    assert.isNull(survivor.dischargesSenderObligationId, "only the link to the obligation goes");
  });

  test("counts the handovers a round would lose, once per handover", async ({ assert }) => {
    const round = await createTestRound({ name: "Teller", generatedAt: DateTime.now() });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const sender = await MatchParticipant.create({
      matchId: match.id,
      userDetailId: "5d765db5fc8c47001c408d81",
    });
    const receiver = await MatchParticipant.create({
      matchId: match.id,
      userDetailId: "5d765db5fc8c47001c408d82",
    });
    const outgoing = await MatchObligation.create({
      matchId: match.id,
      senderParticipantId: sender.id,
      receiverParticipantId: receiver.id,
      itemId: "5b6441c4d2e733002fae89a6",
    });
    const incoming = await MatchObligation.create({
      matchId: match.id,
      senderParticipantId: receiver.id,
      receiverParticipantId: sender.id,
      itemId: "5b6441c4d2e733002fae89a7",
    });
    // One physical handover settling both halves must not be counted twice.
    await BookHandover.create({
      blid: "BL0001234567",
      itemId: "5b6441c4d2e733002fae89a6",
      fromUserDetailId: "5d765db5fc8c47001c408d81",
      toUserDetailId: "5d765db5fc8c47001c408d82",
      occurredAt: DateTime.now(),
      dischargesSenderObligationId: outgoing.id,
      dischargesReceiverObligationId: incoming.id,
    });

    const counts = await MatchRepository.roundCounts();

    assert.deepEqual(counts.get(round.id), { matches: 1, handovers: 1, locked: 2 });
  });

  test("counts only user-match obligations as locked", async ({ assert }) => {
    const round = await createTestRound({ name: "Låst", generatedAt: DateTime.now() });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const [sender, receiver] = await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: "5d765db5fc8c47001c408d81" },
      { matchId: match.id, userDetailId: "5d765db5fc8c47001c408d82" },
    ]);
    await MatchObligation.createMany([
      {
        matchId: match.id,
        senderParticipantId: sender!.id,
        receiverParticipantId: receiver!.id,
        itemId: "5b6441c4d2e733002fae89a6",
        lockedToMatch: true,
      },
      {
        matchId: match.id,
        senderParticipantId: receiver!.id,
        receiverParticipantId: sender!.id,
        itemId: "5b6441c4d2e733002fae89a7",
        lockedToMatch: false,
      },
    ]);
    // A stand match's obligations never count as locked, even with the flag set.
    const standMatch = await Match.create({ roundId: round.id, meetingLocation: "Kantina" });
    const [standSender, standParticipant] = await MatchParticipant.createMany([
      { matchId: standMatch.id, userDetailId: "5d765db5fc8c47001c408d83" },
      { matchId: standMatch.id, userDetailId: null },
    ]);
    await MatchObligation.create({
      matchId: standMatch.id,
      senderParticipantId: standSender!.id,
      receiverParticipantId: standParticipant!.id,
      itemId: "5b6441c4d2e733002fae89a8",
      lockedToMatch: true,
    });

    const counts = await MatchRepository.roundCounts();

    assert.equal(counts.get(round.id)?.locked, 1);
  });
});
