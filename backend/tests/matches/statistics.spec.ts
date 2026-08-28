import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import sinon, { createSandbox } from "sinon";

import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import MatchRound from "#models/match_round";
import { createTestRound } from "#tests/matches/match-testing-utils";
import { MatchRepository } from "#services/matches/match_repository";
import { computeMatchStatistics } from "#services/matches/statistics";
import { StorageService } from "#services/storage_service";
import { unchecked } from "#tests/test-doubles";

/** The matched pair. */
const A = "5d765db5fc8c47001c408d81";
const B = "5d765db5fc8c47001c408d82";
/** A third student, outside their match. */
const C = "5d765db5fc8c47001c408d83";
const ITEM_X = "5d765db5fc8c47001c408e01";

let blidCounter = 0;
function nextBlid() {
  return `BL${String(++blidCounter).padStart(10, "0")}`;
}

test.group("computeMatchStatistics", (group) => {
  let sandbox: sinon.SinonSandbox;
  let round: MatchRound;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.Items, "getMany").resolves(unchecked([]));
    sandbox.stub(StorageService.UserDetails, "getMany").resolves(unchecked([]));
    sandbox.stub(StorageService.Branches, "getAll").resolves(unchecked([]));
  });
  group.each.teardown(() => sandbox.restore());
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    round = await createTestRound({
      name: "Round",
      standLocation: "Kantina",
      generatedAt: DateTime.now().minus({ days: 1 }),
    });
  });

  /** One obligation in its own match; `null` on either side is the stand. */
  async function seedObligation(
    senderId: string | null,
    receiverId: string | null,
    roundId?: number,
  ): Promise<MatchObligation> {
    const match = await Match.create({
      roundId: roundId ?? round.id,
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
      itemId: ITEM_X,
    });
  }

  function handover(input: {
    from: string | null;
    to: string | null;
    sender?: number | null;
    receiver?: number | null;
  }) {
    return MatchRepository.recordHandover({
      blid: nextBlid(),
      itemId: ITEM_X,
      fromUserDetailId: input.from,
      toUserDetailId: input.to,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: input.sender ?? null,
      dischargesReceiverObligationId: input.receiver ?? null,
    });
  }

  test("a handover between the matched pair counts once as planned", async ({ assert }) => {
    // One physical handover is one verdict, even though it settles both obligation halves —
    // the unexpected buckets count per event, so this must too or the donut skews 2:1.
    const obligation = await seedObligation(A, B);
    await handover({ from: A, to: B, sender: obligation.id, receiver: obligation.id });

    const stats = await computeMatchStatistics();

    assert.equal(stats.handoverVerdicts.asPlanned, 1, "counted once per handover");
    assert.equal(stats.handoverVerdicts.fromUnexpectedSender, 0);
    assert.equal(stats.handoverVerdicts.toUnexpectedRecipient, 0);
    assert.equal(stats.userMatchCompletion.completed, 1);
  });

  test("a settled stand obligation counts once as planned", async ({ assert }) => {
    // Stand obligations have a single countable half, so "both halves by one handover"
    // never applies — but a pickup that went as expected still belongs in the planned slice.
    const pickup = await seedObligation(null, A);
    const dropoff = await seedObligation(B, null);
    await handover({ from: null, to: A, receiver: pickup.id });
    await handover({ from: B, to: null, sender: dropoff.id });

    const stats = await computeMatchStatistics();

    assert.equal(stats.handoverVerdicts.asPlanned, 2, "one per stand handover");
    assert.equal(stats.handoverVerdicts.fromUnexpectedSender, 0);
    assert.equal(stats.handoverVerdicts.toUnexpectedRecipient, 0);
  });

  test("a book from someone else is attributed to the sender who actually moved it", async ({
    assert,
  }) => {
    // B was set up to receive from A, but C's copy arrived instead. C's own obligation is what got
    // discharged; A is still on the hook.
    const mine = await seedObligation(A, B);
    const theirs = await seedObligation(C, A);
    await handover({ from: C, to: B, sender: theirs.id, receiver: mine.id });

    const stats = await computeMatchStatistics();

    assert.equal(
      stats.handoverVerdicts.fromUnexpectedSender,
      1,
      "B was served by the wrong person",
    );
    assert.equal(stats.handoverVerdicts.toUnexpectedRecipient, 1, "C's copy went to the wrong one");
    assert.equal(stats.handoverVerdicts.asPlanned, 0);
  });

  test("counts students still liable for their own copy", async ({ assert }) => {
    await seedObligation(A, B);
    await seedObligation(A, C);
    const settled = await seedObligation(B, A);
    await handover({ from: B, to: A, sender: settled.id, receiver: settled.id });

    const stats = await computeMatchStatistics();

    assert.deepEqual(stats.senderLiability, {
      studentsStillResponsible: 1,
      copiesOutstanding: 2,
    });
  });

  test("counts books that moved without settling anything", async ({ assert }) => {
    await seedObligation(A, B);
    await handover({ from: C, to: A });
    await handover({ from: A, to: C });

    const stats = await computeMatchStatistics();

    assert.equal(stats.handoverVerdicts.outsideAnyMatch, 2);
  });

  test("ignores unattached handovers between strangers to the round", async ({ assert }) => {
    // Another school's stand runs in the same weeks: its handovers are unattached too, but they
    // touch none of this round's participants and must not pollute its statistics.
    const D = "5d765db5fc8c47001c408d84";
    await seedObligation(A, B);
    await handover({ from: C, to: D });
    await handover({ from: C, to: A });

    const stats = await computeMatchStatistics();

    assert.equal(stats.handoverVerdicts.outsideAnyMatch, 1, "only A's handover involves the round");
  });

  test("a stand pickup completes on the student's half alone", async ({ assert }) => {
    // The stand handing a book over and the student receiving it are one event, so counting the
    // stand's half would leave every stand match stuck at 50%.
    const obligation = await seedObligation(null, A);
    await handover({ from: null, to: A, receiver: obligation.id });

    const stats = await computeMatchStatistics();

    assert.equal(stats.standMatchCompletion.completed, 1);
    assert.equal(stats.standMatchCompletion.started, 0);
    assert.deepEqual(stats.standBooksOut, { expected: 1, transferred: 1 });
  });

  test("a stand return completes on the student's half alone", async ({ assert }) => {
    const obligation = await seedObligation(A, null);
    await handover({ from: A, to: null, sender: obligation.id });

    const stats = await computeMatchStatistics();

    assert.equal(stats.standMatchCompletion.completed, 1);
    assert.deepEqual(stats.standBooksIn, { expected: 1, transferred: 1 });
    assert.equal(stats.senderLiability.copiesOutstanding, 0);
  });

  test("reports on the named round rather than the newest", async ({ assert }) => {
    await seedObligation(A, B);
    const newer = await createTestRound({ name: "Newer", standLocation: "Kantina" });
    await seedObligation(A, C, newer.id);
    await seedObligation(B, C, newer.id);

    const older = await computeMatchStatistics(round.id);
    const newest = await computeMatchStatistics();

    assert.equal(older.roundName, "Round");
    assert.equal(older.userMatchCount, 1);
    assert.equal(newest.roundName, "Newer");
    assert.equal(newest.userMatchCount, 2);
  });

  test("reports nothing rather than failing when no round exists", async ({ assert }) => {
    await round.delete();

    const stats = await computeMatchStatistics();

    assert.equal(stats.roundId, "");
    assert.equal(stats.userMatchCount, 0);
  });

  test("splits students by whether they must visit the stand", async ({ assert }) => {
    await seedObligation(A, B);
    await seedObligation(null, C);

    const stats = await computeMatchStatistics();

    assert.equal(stats.studentReach.totalStudents, 3);
    assert.equal(stats.studentReach.onlyUserHandovers, 2);
    assert.equal(stats.studentReach.mustVisitStand, 1);
  });
});
