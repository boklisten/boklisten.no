import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchRound from "#models/match_round";
import { generateRound } from "#services/matches/generate_round";
import User from "#models/user";
import { createBranch } from "#tests/branch_fixtures";
import {
  createHeldBooks,
  createTestRound,
  ensureUsers,
  seedTestCatalogue,
  TEST_DEADLINE,
  TEST_MEETING_DATE,
} from "#tests/matches/match-testing-utils";
import { createOrder } from "#tests/order_fixtures";
import { userDouble } from "#tests/user_fixtures";

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
  createTestRound({ name: "Ullern Vår 2026", branchId: BRANCH, standLocation: "Kantina" });

/** The titles a customer holds, handed out at the round's branch and due on its deadline. */
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
  group.each.setup(seedTestCatalogue);
  group.each.setup(() => ensureUsers([A, B]));
  group.each.setup(async () => {
    await createBranch({ id: BRANCH });
  });

  /**
   * Inserts the held books and the orders.
   *
   * @param wanted who ordered which items themselves at the branch
   */
  async function arrange(
    held: ReturnType<typeof heldBy>[],
    wanted: { id: string; wantedItems: string[] }[],
    users: { id: string; branchMembership?: string }[] = [],
  ) {
    await createHeldBooks(BRANCH, held);
    for (const { id, wantedItems } of wanted) {
      await createOrder({
        branchId: BRANCH,
        customerId: id,
        byCustomer: true,
        orderItems: wantedItems.map((itemId) => ({ itemId })),
      });
    }
    sandbox
      .stub(User, "byIds")
      .resolves(
        new Map(
          users.map((user) => [
            user.id,
            userDouble({ id: user.id, branchMembershipId: user.branchMembership ?? null }),
          ]),
        ),
      );
  }

  test("creates an obligation per matched title, with both parties named", async ({ assert }) => {
    // A holds X and wants Y; B holds Y and wants X — a clean two-way swap.
    await arrange(
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

    const fromA = obligations.find((o) => o.sender.userId === A);
    assert.equal(fromA?.itemId, ITEM_X);
    assert.equal(fromA?.receiver.userId, B);

    const fromB = obligations.find((o) => o.sender.userId === B);
    assert.equal(fromB?.itemId, ITEM_Y);
    assert.equal(fromB?.receiver.userId, A);
  });

  test("every match has exactly two participants", async ({ assert }) => {
    await arrange([heldBy(A, [ITEM_X])], [{ id: B, wantedItems: [ITEM_X] }]);

    await generateRound(await plannedRound());

    const matches = await Match.query().preload("participants");
    assert.isNotEmpty(matches);
    for (const match of matches) {
      assert.lengthOf(match.participants, 2);
    }
  });

  test("a stand pickup owes no particular copy", async ({ assert }) => {
    // B wants X and nobody holds it, so it can only come from the stand.
    await arrange([], [{ id: B, wantedItems: [ITEM_X] }]);

    await generateRound(await plannedRound());

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const pickup = obligations.find((o) => o.sender.userId === null);
    assert.isDefined(pickup);
    assert.equal(pickup!.receiver.userId, B);
  });

  test("matches equivalent editions between students, naming the sender's edition", async ({
    assert,
  }) => {
    // A holds the 2009 edition; B ordered the 2012 edition. The editions are interchangeable, so
    // the two should meet — and the obligation must name the copy that will actually move: A's.
    await arrange(
      [heldBy(A, [GYMNOS_2009]), heldBy(B, [ITEM_Y])],
      [
        { id: A, wantedItems: [ITEM_Y] },
        { id: B, wantedItems: [GYMNOS_2012] },
      ],
    );

    await generateRound(await plannedRound());

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const fromA = obligations.find((o) => o.sender.userId === A);
    assert.equal(fromA?.receiver.userId, B, "the two students are matched with each other");
    assert.equal(fromA?.itemId, GYMNOS_2009, "the obligation names the edition A actually holds");
  });

  test("a cross-edition stand pickup names the edition the receiver ordered", async ({
    assert,
  }) => {
    // Nobody holds any GYMNOS; B ordered the 2012 edition. The pickup must say 2012, not the
    // equivalence group's canonical id.
    await arrange([], [{ id: B, wantedItems: [GYMNOS_2012] }]);

    await generateRound(await plannedRound());

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const pickup = obligations.find((o) => o.sender.userId === null);
    assert.equal(pickup?.receiver.userId, B);
    assert.equal(pickup?.itemId, GYMNOS_2012);
  });

  test("a cross-edition stand handoff names the edition the sender holds", async ({ assert }) => {
    await arrange([heldBy(A, [GYMNOS_2012])], []);

    await generateRound(await plannedRound());

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const handoff = obligations.find((o) => o.receiver.userId === null);
    assert.equal(handoff?.sender.userId, A);
    assert.equal(handoff?.itemId, GYMNOS_2012);
  });

  test("a stand handoff records the customer as sender", async ({ assert }) => {
    // A holds X and nobody wants it, so it goes back to the stand.
    await arrange([heldBy(A, [ITEM_X])], []);

    await generateRound(await plannedRound());

    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const handoff = obligations.find((o) => o.receiver.userId === null);
    assert.isDefined(handoff);
    assert.equal(handoff!.sender.userId, A);
  });

  test("a stand student gets no student matches: all their books go via the stand", async ({
    assert,
  }) => {
    // A and B could swap X for Y, but A must go via the stand — so B goes via the stand too.
    await arrange(
      [heldBy(A, [ITEM_X]), heldBy(B, [ITEM_Y])],
      [
        { id: A, wantedItems: [ITEM_Y] },
        { id: B, wantedItems: [ITEM_X] },
      ],
    );
    const round = await createTestRound({ branchId: BRANCH, standCustomerIds: [A] });

    const result = await generateRound(round);

    assert.equal(result.userMatchCount, 0, "nobody is matched with a stand student");
    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    const involvingA = obligations.filter((o) => o.sender.userId === A || o.receiver.userId === A);
    assert.sameDeepMembers(
      involvingA.map((o) => [o.sender.userId, o.receiver.userId, o.itemId]),
      [
        [A, null, ITEM_X],
        [null, A, ITEM_Y],
      ],
      "A hands in X and picks up Y at the stand",
    );

    const pickup = obligations.find((o) => o.receiver.userId === B && o.itemId === ITEM_X);
    assert.isNull(pickup!.sender.userId, "B gets X from the stand, not from A");
    const handoff = obligations.find((o) => o.sender.userId === B && o.itemId === ITEM_Y);
    assert.isNull(handoff!.receiver.userId, "B returns Y to the stand, not to A");
  });

  test("covers the books of every descendant, and nothing outside the round's branch", async ({
    assert,
  }) => {
    const child = await createBranch({ parentBranchId: BRANCH });
    const grandchild = await createBranch({ parentBranchId: child.id });
    const outside = await createBranch();
    await arrange([], []);
    await createHeldBooks(grandchild.id, [heldBy(A, [ITEM_X])]);
    await createOrder({
      branchId: child.id,
      customerId: B,
      byCustomer: true,
      orderItems: [{ itemId: ITEM_X }],
    });
    await createHeldBooks(outside.id, [heldBy(B, [ITEM_Y])]);

    const result = await generateRound(await plannedRound());

    assert.equal(result.userMatchCount, 1, "A (grandchild) and B (child) swap X");
    const items = (await MatchObligation.all()).map((o) => o.itemId);
    assert.notInclude(items, ITEM_Y, "the book handed out outside the round stays out");
  });

  test("books handed out or ordered in a stand subtree go via the stand, the rest still match", async ({
    assert,
  }) => {
    const standProgram = await createBranch({ parentBranchId: BRANCH });
    const standClass = await createBranch({ parentBranchId: standProgram.id });
    // Y is handed out and X ordered in the stand subtree, so both go via the stand. B's copy of
    // X was handed out at the round's own branch, so B could still swap it with anyone.
    await arrange([heldBy(B, [ITEM_X])], []);
    await createHeldBooks(standClass.id, [heldBy(A, [ITEM_Y])]);
    await createOrder({
      branchId: standClass.id,
      customerId: A,
      byCustomer: true,
      orderItems: [{ itemId: ITEM_X }],
    });
    const round = await createTestRound({ branchId: BRANCH, standBranchIds: [standProgram.id] });

    const result = await generateRound(round);

    assert.equal(result.userMatchCount, 0, "A's stand books are not offered to B");
    const obligations = await MatchObligation.query().preload("sender").preload("receiver");
    assert.sameDeepMembers(
      obligations.map((o) => [o.sender.userId, o.receiver.userId, o.itemId]),
      [
        [A, null, ITEM_Y],
        [null, A, ITEM_X],
        [B, null, ITEM_X],
      ],
    );
    const aStandMatches = await Match.query().whereHas("participants", (participants) =>
      participants.where("userId", A),
    );
    assert.lengthOf(aStandMatches, 1, "one stand visit per student");
  });

  test("reports when there is nobody to match", async ({ assert }) => {
    await arrange([], []);

    await assert.rejects(async () => generateRound(await plannedRound()), /Fant ingen elever/);
  });

  test("user matches get a slot and location inside the meeting window", async ({ assert }) => {
    await arrange(
      [heldBy(A, [ITEM_X]), heldBy(B, [ITEM_Y])],
      [
        { id: A, wantedItems: [ITEM_Y] },
        { id: B, wantedItems: [ITEM_X] },
      ],
    );

    await generateRound(await plannedRound());

    const matches = await Match.query().preload("participants");
    const userMatches = matches.filter((match) =>
      match.participants.every((participant) => participant.userId !== null),
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
    await arrange([heldBy(A, [ITEM_X])], []);

    await generateRound(await plannedRound());

    const matches = await Match.query().preload("participants");
    const standMatches = matches.filter((match) =>
      match.participants.some((participant) => participant.userId === null),
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

  test("looks for books due on the deadline day only", async ({ assert }) => {
    // A's copy is due on the deadline; B's the day after.
    await createHeldBooks(BRANCH, [heldBy(A, [ITEM_X])], TEST_DEADLINE);
    await createHeldBooks(BRANCH, [heldBy(B, [ITEM_Y])], TEST_DEADLINE.plus({ days: 1 }));
    await arrange(
      [],
      [
        { id: A, wantedItems: [ITEM_Y] },
        { id: B, wantedItems: [ITEM_X] },
      ],
    );

    await generateRound(await plannedRound());

    const obligations = await MatchObligation.query().preload("sender");
    const senders = obligations.map((obligation) => obligation.sender.userId);
    assert.include(senders, A, "a book due on the deadline is picked up");
    assert.notInclude(senders, B, "a book due the day after the deadline is not");
  });

  test("refuses to generate a round twice", async ({ assert }) => {
    await arrange([heldBy(A, [ITEM_X])], [{ id: B, wantedItems: [ITEM_X] }]);
    const round = await plannedRound();

    await generateRound(round);

    await assert.rejects(
      async () => generateRound(await MatchRound.findOrFail(round.id)),
      /allerede overleveringer/,
    );
  });

  test("refuses a round whose deadline has already passed", async ({ assert }) => {
    await arrange([heldBy(A, [ITEM_X])], [{ id: B, wantedItems: [ITEM_X] }]);
    const round = await createTestRound({
      branchId: BRANCH,
      deadline: DateTime.now().minus({ days: 1 }),
    });

    await assert.rejects(() => generateRound(round), /Fristen for runden har allerede passert/);
  });

  test("stamps the round as generated, which is what ends its planned state", async ({
    assert,
  }) => {
    await arrange([heldBy(A, [ITEM_X])], [{ id: B, wantedItems: [ITEM_X] }]);
    const round = await plannedRound();
    assert.isNull(
      (await MatchRound.findOrFail(round.id)).generatedAt,
      "a freshly planned round has not been generated",
    );

    await generateRound(round);

    assert.isNotNull((await MatchRound.findOrFail(round.id)).generatedAt);
  });
});
