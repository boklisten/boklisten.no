import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import BookHandover from "#models/book_handover";
import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import MatchRound from "#models/match_round";

test.group("match round management", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("lists rounds newest first", async ({ assert }) => {
    await MatchRound.create({ name: "Høst 2025", standLocation: "Kantina" });
    await MatchRound.create({ name: "Vår 2026", standLocation: "Biblioteket" });

    const rounds = await MatchRound.query().orderBy("id", "desc");

    assert.deepEqual(
      rounds.map((round) => round.name),
      ["Vår 2026", "Høst 2025"],
    );
  });

  test("renames a round", async ({ assert }) => {
    const round = await MatchRound.create({ name: "Feilstavet", standLocation: "Kantina" });

    await round.merge({ name: "Ullern Vår 2026" }).save();

    assert.equal((await MatchRound.findOrFail(round.id)).name, "Ullern Vår 2026");
  });

  test("switches a round off again", async ({ assert }) => {
    const round = await MatchRound.create({
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
    const round = await MatchRound.create({ name: "Slettes", standLocation: "Kantina" });
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
});
