import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchRound from "#models/match_round";
import { generateRound } from "#services/matches/generate_round";
import { StorageService } from "#services/storage_service";
import {
  TEST_DEADLINE,
  TEST_MEETING_DATE,
  createTestRound,
} from "#tests/matches/match-testing-utils";
import { unchecked } from "#tests/test-doubles";

const A = "5d765db5fc8c47001c408d81";
const B = "5d765db5fc8c47001c408d82";
const ITEM_X = "5d765db5fc8c47001c408e01";
const ITEM_Y = "5d765db5fc8c47001c408e02";
const BRANCH = "5d765db5fc8c47001c408b01";
/** The two GYMNOS editions customers order interchangeably. */
const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";

/** A planned round with the shape these tests assert against. */
const plannedRound = () =>
  createTestRound({ name: "Ullern Vår 2026", branches: [BRANCH], standLocation: "Kantina" });

/** One aggregated `{ id, items }` row as `getHeldItems` expects it back from Mongo. */
function heldBy(customerId: string, itemIds: string[]) {
  return { id: customerId, items: itemIds };
}

test.group("generateRound", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());
  group.each.setup(() => testUtils.db().truncate());

  /** @param wanted aggregated order rows: who wants which items */
  function stubMongo(
    held: ReturnType<typeof heldBy>[],
    wanted: { id: string; wantedItems: string[] }[],
    userDetails: { id: string; branchMembership?: string }[] = [],
  ) {
    sandbox.stub(StorageService.CustomerItems, "aggregate").resolves(held);
    sandbox.stub(StorageService.Orders, "aggregate").resolves(wanted);
    sandbox.stub(StorageService.UserDetails, "aggregate").resolves(userDetails);
  }

  test("creates an obligation per matched title, with both parties named", async ({ assert }) => {
    // A holds X and wants Y; B holds Y and wants X — a clean two-way swap.
    stubMongo(
      [heldBy(A, [ITEM_X]), heldBy(B, [ITEM_Y])],
      [
        { id: A, wantedItems: [ITEM_Y] },
        { id: B, wantedItems: [ITEM_X] },
      ],
    );

    const result = await generateRound(await plannedRound());

    const round = await MatchRound.findOrFail(Number(result.roundId));
    assert.equal(round.name, "Ullern Vår 2026");
    assert.equal(round.status, "draft", "a generated round must stay invisible until switched on");

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    assert.lengthOf(obligations, 2);

    const fromA = obligations.find((o) => o.sender.userDetailId === A);
    assert.equal(fromA?.itemId, ITEM_X);
    assert.equal(fromA?.receiver.userDetailId, B);

    const fromB = obligations.find((o) => o.sender.userDetailId === B);
    assert.equal(fromB?.itemId, ITEM_Y);
    assert.equal(fromB?.receiver.userDetailId, A);
  });

  test("every match has exactly two participants", async ({ assert }) => {
    stubMongo([heldBy(A, [ITEM_X])], [{ id: B, wantedItems: [ITEM_X] }]);

    await generateRound(await plannedRound());

    const matches = await Match.query().preload("participants");
    assert.isNotEmpty(matches);
    for (const match of matches) {
      assert.lengthOf(match.participants, 2);
    }
  });

  test("a stand pickup owes no particular copy", async ({ assert }) => {
    // B wants X and nobody holds it, so it can only come from the stand.
    stubMongo([], [{ id: B, wantedItems: [ITEM_X] }]);

    await generateRound(await plannedRound());

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const pickup = obligations.find((o) => o.sender.userDetailId === null);
    assert.isDefined(pickup);
    assert.equal(pickup!.receiver.userDetailId, B);
  });

  test("matches equivalent editions between students, naming the sender's edition", async ({
    assert,
  }) => {
    // A holds the 2009 edition; B ordered the 2012 edition. The editions are interchangeable, so
    // the two should meet — and the obligation must name the copy that will actually move: A's.
    stubMongo(
      [heldBy(A, [GYMNOS_2009]), heldBy(B, [ITEM_Y])],
      [
        { id: A, wantedItems: [ITEM_Y] },
        { id: B, wantedItems: [GYMNOS_2012] },
      ],
    );

    await generateRound(await plannedRound());

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const fromA = obligations.find((o) => o.sender.userDetailId === A);
    assert.equal(fromA?.receiver.userDetailId, B, "the two students are matched with each other");
    assert.equal(fromA?.itemId, GYMNOS_2009, "the obligation names the edition A actually holds");
  });

  test("a cross-edition stand pickup names the edition the receiver ordered", async ({
    assert,
  }) => {
    // Nobody holds any GYMNOS; B ordered the 2012 edition. The pickup must say 2012, not the
    // equivalence group's canonical id.
    stubMongo([], [{ id: B, wantedItems: [GYMNOS_2012] }]);

    await generateRound(await plannedRound());

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const pickup = obligations.find((o) => o.sender.userDetailId === null);
    assert.equal(pickup?.receiver.userDetailId, B);
    assert.equal(pickup?.itemId, GYMNOS_2012);
  });

  test("a cross-edition stand handoff names the edition the sender holds", async ({ assert }) => {
    stubMongo([heldBy(A, [GYMNOS_2012])], []);

    await generateRound(await plannedRound());

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const handoff = obligations.find((o) => o.receiver.userDetailId === null);
    assert.equal(handoff?.sender.userDetailId, A);
    assert.equal(handoff?.itemId, GYMNOS_2012);
  });

  test("a stand handoff records the customer as sender", async ({ assert }) => {
    // A holds X and nobody wants it, so it goes back to the stand.
    stubMongo([heldBy(A, [ITEM_X])], []);

    await generateRound(await plannedRound());

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const handoff = obligations.find((o) => o.receiver.userDetailId === null);
    assert.isDefined(handoff);
    assert.equal(handoff!.sender.userDetailId, A);
  });

  test("an excluded customer gets no matches, and their books come from the stand", async ({
    assert,
  }) => {
    // A and B could swap X for Y, but A is excluded — so B must go through the stand instead.
    stubMongo(
      [heldBy(A, [ITEM_X]), heldBy(B, [ITEM_Y])],
      [
        { id: A, wantedItems: [ITEM_Y] },
        { id: B, wantedItems: [ITEM_X] },
      ],
    );
    const round = await createTestRound({ branches: [BRANCH], excludedCustomerIds: [A] });

    await generateRound(round);

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    assert.isNotEmpty(obligations);
    for (const o of obligations) {
      assert.notEqual(o.sender.userDetailId, A, "an excluded customer must never send");
      assert.notEqual(o.receiver.userDetailId, A, "an excluded customer must never receive");
    }

    const pickup = obligations.find((o) => o.receiver.userDetailId === B && o.itemId === ITEM_X);
    assert.isDefined(pickup, "B still gets the book they wanted");
    assert.isNull(pickup!.sender.userDetailId, "…but from the stand, not from A");

    const handoff = obligations.find((o) => o.sender.userDetailId === B && o.itemId === ITEM_Y);
    assert.isDefined(handoff, "B still returns their book");
    assert.isNull(handoff!.receiver.userDetailId, "…but to the stand, not to A");
  });

  test("reports when there is nobody to match", async ({ assert }) => {
    stubMongo([], []);

    await assert.rejects(async () => generateRound(await plannedRound()), /Fant ingen elever/);
  });

  test("user matches get a slot and location inside the meeting window", async ({ assert }) => {
    stubMongo(
      [heldBy(A, [ITEM_X]), heldBy(B, [ITEM_Y])],
      [
        { id: A, wantedItems: [ITEM_Y] },
        { id: B, wantedItems: [ITEM_X] },
      ],
    );

    await generateRound(await plannedRound());

    const matches = await Match.query().preload("participants");
    const userMatches = matches.filter((match) =>
      match.participants.every((participant) => participant.userDetailId !== null),
    );
    assert.isNotEmpty(userMatches);
    for (const match of userMatches) {
      assert.equal(match.meetingLocation, "Biblioteket");
      assert.isNotNull(match.meetingTime);
      const oslo = match.meetingTime!.setZone("Europe/Oslo");
      assert.equal(oslo.toISODate(), TEST_MEETING_DATE.toISODate());
      assert.isTrue(oslo.hour >= 12 && oslo.hour < 14, "inside the 12:00–14:00 window");
      assert.equal(oslo.minute % 10, 0, "on a ten-minute tick");
    }
  });

  test("stand matches keep the stand location and get a slot in the stand window", async ({
    assert,
  }) => {
    // A holds X and nobody wants it: a pure stand handoff.
    stubMongo([heldBy(A, [ITEM_X])], []);

    await generateRound(await plannedRound());

    const matches = await Match.query().preload("participants");
    const standMatches = matches.filter((match) =>
      match.participants.some((participant) => participant.userDetailId === null),
    );
    assert.isNotEmpty(standMatches);
    for (const match of standMatches) {
      assert.equal(match.meetingLocation, "Kantina");
      assert.isNotNull(match.meetingTime);
      const oslo = match.meetingTime!.setZone("Europe/Oslo");
      assert.isTrue(oslo.hour >= 12 && oslo.hour < 16, "inside the 12:00–16:00 stand window");
      assert.equal(oslo.minute % 10, 0, "on a ten-minute tick");
    }
  });

  test("looks for books due on the deadline, give or take two days", async ({ assert }) => {
    const aggregateStub = sandbox
      .stub(StorageService.CustomerItems, "aggregate")
      .resolves(unchecked([heldBy(A, [ITEM_X])]));
    sandbox.stub(StorageService.Orders, "aggregate").resolves(unchecked([]));
    sandbox.stub(StorageService.UserDetails, "aggregate").resolves(unchecked([]));

    await generateRound(await plannedRound());

    const pipeline: [{ $match: { deadline: { $gt: Date; $lt: Date } } }] = unchecked(
      aggregateStub.firstCall.args[0],
    );
    const { $gt, $lt } = pipeline[0].$match.deadline;
    assert.equal(
      $gt.toISOString(),
      TEST_DEADLINE.minus({ days: 2 }).toJSDate().toISOString(),
      "two days before the deadline, covering timezone drift in stored deadlines",
    );
    assert.equal(
      $lt.toISOString(),
      TEST_DEADLINE.plus({ days: 2 }).toJSDate().toISOString(),
      "two days after the deadline",
    );
  });

  test("refuses to generate a round twice", async ({ assert }) => {
    stubMongo([heldBy(A, [ITEM_X])], [{ id: B, wantedItems: [ITEM_X] }]);
    const round = await plannedRound();

    await generateRound(round);

    await assert.rejects(
      async () => generateRound(await MatchRound.findOrFail(round.id)),
      /allerede overleveringer/,
    );
  });

  test("refuses a round whose deadline has already passed", async ({ assert }) => {
    stubMongo([heldBy(A, [ITEM_X])], [{ id: B, wantedItems: [ITEM_X] }]);
    const round = await createTestRound({
      branches: [BRANCH],
      deadline: DateTime.now().minus({ days: 1 }),
    });

    await assert.rejects(() => generateRound(round), /Fristen for runden har allerede passert/);
  });

  test("stamps the round as generated, which is what ends its planned state", async ({
    assert,
  }) => {
    stubMongo([heldBy(A, [ITEM_X])], [{ id: B, wantedItems: [ITEM_X] }]);
    const round = await plannedRound();
    assert.isNull(
      (await MatchRound.findOrFail(round.id)).generatedAt,
      "a freshly planned round has not been generated",
    );

    await generateRound(round);

    assert.isNotNull((await MatchRound.findOrFail(round.id)).generatedAt);
  });
});
