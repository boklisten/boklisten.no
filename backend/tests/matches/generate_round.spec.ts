import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import sinon, { createSandbox } from "sinon";

import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchRound from "#models/match_round";
import { generateRound } from "#services/matches/generate_round";
import { StorageService } from "#services/storage_service";

/** chai-as-promised is not registered in this suite, so assert rejections explicitly. */
async function expectRejection(promise: Promise<unknown>, pattern: RegExp) {
  const error = await promise.then(
    () => null,
    (caught: Error) => caught,
  );
  if (error === null) throw new Error(`expected a rejection matching ${pattern}`);
  if (!pattern.test(error.message)) {
    throw new Error(`expected "${error.message}" to match ${pattern}`);
  }
}

const A = "5d765db5fc8c47001c408d81";
const B = "5d765db5fc8c47001c408d82";
const ITEM_X = "5d765db5fc8c47001c408e01";
const ITEM_Y = "5d765db5fc8c47001c408e02";
const BRANCH = "5d765db5fc8c47001c408b01";

const config = {
  name: "Ullern Vår 2026",
  branches: [BRANCH],
  standLocation: "Kantina",
  meetingDate: "2026-06-01",
  userMeetingWindow: { from: "12:00", to: "14:00" },
  standWindow: { from: "12:00", to: "16:00" },
  userMatchLocations: ["Biblioteket"],
  deadlineBefore: new Date("2026-07-01T00:00:00Z"),
  includeCustomerItemsFromOtherBranches: false,
};

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
    sandbox.stub(StorageService.CustomerItems, "aggregate").resolves(held as never);
    sandbox.stub(StorageService.Orders, "aggregate").resolves(wanted as never);
    sandbox.stub(StorageService.UserDetails, "aggregate").resolves(userDetails as never);
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

    const result = await generateRound(config);

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

    await generateRound(config);

    const matches = await Match.query().preload("participants");
    assert.isNotEmpty(matches);
    for (const match of matches) {
      assert.lengthOf(match.participants, 2);
    }
  });

  test("a stand pickup owes no particular copy", async ({ assert }) => {
    // B wants X and nobody holds it, so it can only come from the stand.
    stubMongo([], [{ id: B, wantedItems: [ITEM_X] }]);

    await generateRound(config);

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const pickup = obligations.find((o) => o.sender.userDetailId === null);
    assert.isDefined(pickup);
    assert.equal(pickup!.receiver.userDetailId, B);
  });

  test("a stand handoff records the customer as sender", async ({ assert }) => {
    // A holds X and nobody wants it, so it goes back to the stand.
    stubMongo([heldBy(A, [ITEM_X])], []);

    await generateRound(config);

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const handoff = obligations.find((o) => o.receiver.userDetailId === null);
    assert.isDefined(handoff);
    assert.equal(handoff!.sender.userDetailId, A);
  });

  test("reports when there is nobody to match", async () => {
    stubMongo([], []);

    await expectRejection(generateRound(config), /Fant ingen elever/);
  });

  test("user matches get a slot and location inside the meeting window", async ({ assert }) => {
    stubMongo(
      [heldBy(A, [ITEM_X]), heldBy(B, [ITEM_Y])],
      [
        { id: A, wantedItems: [ITEM_Y] },
        { id: B, wantedItems: [ITEM_X] },
      ],
    );

    await generateRound(config);

    const matches = await Match.query().preload("participants");
    const userMatches = matches.filter((match) =>
      match.participants.every((participant) => participant.userDetailId !== null),
    );
    assert.isNotEmpty(userMatches);
    for (const match of userMatches) {
      assert.equal(match.meetingLocation, "Biblioteket");
      assert.isNotNull(match.meetingTime);
      const oslo = match.meetingTime!.setZone("Europe/Oslo");
      assert.equal(oslo.toISODate(), "2026-06-01");
      assert.isTrue(oslo.hour >= 12 && oslo.hour < 14, "inside the 12:00–14:00 window");
      assert.equal(oslo.minute % 10, 0, "on a ten-minute tick");
    }
  });

  test("stand matches keep the stand location and get a slot in the stand window", async ({
    assert,
  }) => {
    // A holds X and nobody wants it: a pure stand handoff.
    stubMongo([heldBy(A, [ITEM_X])], []);

    await generateRound(config);

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

  test("queries held books with two days of deadline padding", async ({ assert }) => {
    const aggregateStub = sandbox
      .stub(StorageService.CustomerItems, "aggregate")
      .resolves([heldBy(A, [ITEM_X])] as never);
    sandbox.stub(StorageService.Orders, "aggregate").resolves([] as never);
    sandbox.stub(StorageService.UserDetails, "aggregate").resolves([] as never);

    await generateRound(config);

    const pipeline = aggregateStub.firstCall.args[0] as [{ $match: { deadline: { $lte: Date } } }];
    assert.equal(
      pipeline[0].$match.deadline.$lte.toISOString(),
      "2026-07-03T00:00:00.000Z",
      "deadlineBefore + 2 days, covering timezone drift in stored deadlines",
    );
  });
});
