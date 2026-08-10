import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import BookHandover from "#models/book_handover";
import Match from "#models/match";
import MatchParticipant from "#models/match_participant";
import MatchObligation from "#models/match_obligation";
import MatchRound from "#models/match_round";
import { isDischargeConflict, MatchRepository } from "#services/matches/match_repository";

const A = "5d765db5fc8c47001c408d81";
const B = "5d765db5fc8c47001c408d82";
const C = "5d765db5fc8c47001c408d83";
const ITEM_X = "5d765db5fc8c47001c408e01";

test.group("match rounds", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("stores a round", async ({ assert }) => {
    const round = await MatchRound.create({
      name: "Ullern Vår 2026",
      standLocation: "Kantina",
      status: "active",
      generatedAt: DateTime.fromISO("2026-06-01T09:00:00Z"),
    });

    const loaded = await MatchRound.findOrFail(round.id);
    assert.equal(loaded.name, "Ullern Vår 2026");
    assert.equal(loaded.standLocation, "Kantina");
    assert.equal(loaded.status, "active");
  });

  test("defaults a new round to draft", async ({ assert }) => {
    const round = await MatchRound.create({ name: "New", standLocation: "Kantina" });
    assert.equal((await MatchRound.findOrFail(round.id)).status, "draft");
  });

  test("rejects an unknown status", async () => {
    await MatchRound.create({ name: "Bad", standLocation: "Kantina", status: "sometime" }).then(
      () => {
        throw new Error("expected the status check constraint to reject 'sometime'");
      },
      () => undefined,
    );
  });
});

test.group("match participants", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  async function createRound() {
    return MatchRound.create({ name: "Round", standLocation: "Kantina" });
  }

  test("a user match has two customer participants", async ({ assert }) => {
    const round = await createRound();
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: A },
      { matchId: match.id, userDetailId: B },
    ]);

    const loaded = await Match.query().where("id", match.id).preload("participants").firstOrFail();
    assert.lengthOf(loaded.participants, 2);
    assert.isFalse(loaded.participants.some((p) => p.isStand));
  });

  test("a stand match has one customer and one stand participant", async ({ assert }) => {
    const round = await createRound();
    const match = await Match.create({ roundId: round.id, meetingLocation: "Kantina" });
    await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: C },
      { matchId: match.id, userDetailId: null },
    ]);

    const loaded = await Match.query().where("id", match.id).preload("participants").firstOrFail();
    assert.lengthOf(
      loaded.participants.filter((p) => p.isStand),
      1,
    );
  });

  test("finds a customer's matches with a single indexed lookup", async ({ assert }) => {
    const round = await createRound();
    const mine = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const other = await Match.create({ roundId: round.id, meetingLocation: "Kantina" });
    await MatchParticipant.createMany([
      { matchId: mine.id, userDetailId: A },
      { matchId: mine.id, userDetailId: B },
      { matchId: other.id, userDetailId: C },
      { matchId: other.id, userDetailId: null },
    ]);

    const found = await Match.query().whereHas("participants", (query) =>
      query.where("userDetailId", A),
    );
    assert.lengthOf(found, 1);
    assert.equal(found[0]?.id, mine.id);
  });

  test("rejects the same customer joining a match twice", async () => {
    const round = await createRound();
    const match = await Match.create({ roundId: round.id, meetingLocation: "Kantina" });
    await MatchParticipant.create({ matchId: match.id, userDetailId: A });

    await MatchParticipant.create({ matchId: match.id, userDetailId: A }).then(
      () => {
        throw new Error("expected the (match_id, user_detail_id) unique constraint to reject this");
      },
      () => undefined,
    );
  });

  test("rejects a second stand participant in the same match", async () => {
    const round = await createRound();
    const match = await Match.create({ roundId: round.id, meetingLocation: "Kantina" });
    await MatchParticipant.create({ matchId: match.id, userDetailId: null });

    await MatchParticipant.create({ matchId: match.id, userDetailId: null }).then(
      () => {
        throw new Error("expected the single-stand partial unique index to reject this");
      },
      () => undefined,
    );
  });

  test("cascades participants when a match is deleted", async ({ assert }) => {
    const round = await createRound();
    const match = await Match.create({ roundId: round.id, meetingLocation: "Kantina" });
    await MatchParticipant.create({ matchId: match.id, userDetailId: A });

    await match.delete();

    assert.lengthOf(await MatchParticipant.all(), 0);
  });
});

test.group("match obligations", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  async function createUserMatch() {
    const round = await MatchRound.create({ name: "Round", standLocation: "Kantina" });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const [a, b] = await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: A },
      { matchId: match.id, userDetailId: B },
    ]);
    return { match, a: a!, b: b! };
  }

  test("stores an obligation between two parties of the match", async ({ assert }) => {
    const { match, a, b } = await createUserMatch();
    await MatchObligation.create({
      matchId: match.id,
      senderParticipantId: a.id,
      receiverParticipantId: b.id,
      itemId: ITEM_X,
      lockedToMatch: true,
    });

    const loaded = await MatchObligation.query()
      .preload("sender")
      .preload("receiver")
      .firstOrFail();
    assert.equal(loaded.itemId, ITEM_X);
    assert.equal(loaded.sender.userDetailId, A);
    assert.equal(loaded.receiver.userDetailId, B);
    assert.isTrue(loaded.lockedToMatch);
  });

  test("allows two rows for two copies of the same title", async ({ assert }) => {
    const { match, a, b } = await createUserMatch();
    await MatchObligation.createMany([
      { matchId: match.id, senderParticipantId: a.id, receiverParticipantId: b.id, itemId: ITEM_X },
      { matchId: match.id, senderParticipantId: a.id, receiverParticipantId: b.id, itemId: ITEM_X },
    ]);

    assert.lengthOf(await MatchObligation.all(), 2);
  });

  test("rejects a participant from a different match", async () => {
    const first = await createUserMatch();
    const second = await createUserMatch();

    await MatchObligation.create({
      matchId: first.match.id,
      senderParticipantId: first.a.id,
      receiverParticipantId: second.b.id,
      itemId: ITEM_X,
    }).then(
      () => {
        throw new Error("expected the composite foreign key to reject a foreign participant");
      },
      () => undefined,
    );
  });

  test("rejects an obligation where sender and receiver are the same party", async () => {
    const { match, a } = await createUserMatch();

    await MatchObligation.create({
      matchId: match.id,
      senderParticipantId: a.id,
      receiverParticipantId: a.id,
      itemId: ITEM_X,
    }).then(
      () => {
        throw new Error("expected the distinct-parties check constraint to reject this");
      },
      () => undefined,
    );
  });
});

test.group("book handovers", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("records a stand pickup with the stand as the origin", async ({ assert }) => {
    await BookHandover.create({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserDetailId: null,
      toUserDetailId: A,
      occurredAt: DateTime.fromISO("2026-06-01T10:00:00Z"),
      orderId: "5d765db5fc8c47001c408a01",
    });

    const loaded = await BookHandover.firstOrFail();
    assert.isNull(loaded.fromUserDetailId);
    assert.equal(loaded.toUserDetailId, A);
  });

  test("records a stand return with the stand as the destination", async ({ assert }) => {
    await BookHandover.create({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserDetailId: A,
      toUserDetailId: null,
      occurredAt: DateTime.fromISO("2026-06-01T10:00:00Z"),
    });

    const loaded = await BookHandover.firstOrFail();
    assert.equal(loaded.fromUserDetailId, A);
    assert.isNull(loaded.toUserDetailId);
  });

  test("returns a blid's full chain of custody in order", async ({ assert }) => {
    await BookHandover.createMany([
      {
        blid: "BL0001234567",
        itemId: ITEM_X,
        fromUserDetailId: null,
        toUserDetailId: A,
        occurredAt: DateTime.fromISO("2026-01-05T10:00:00Z"),
      },
      {
        blid: "BL0001234567",
        itemId: ITEM_X,
        fromUserDetailId: A,
        toUserDetailId: B,
        occurredAt: DateTime.fromISO("2026-06-01T10:00:00Z"),
      },
      {
        blid: "BL0009999999",
        itemId: ITEM_X,
        fromUserDetailId: null,
        toUserDetailId: C,
        occurredAt: DateTime.fromISO("2026-06-01T10:00:00Z"),
      },
    ]);

    const chain = await BookHandover.query()
      .where("blid", "BL0001234567")
      .orderBy("occurredAt", "asc");

    assert.lengthOf(chain, 2);
    assert.isNull(chain[0]?.fromUserDetailId);
    assert.equal(chain[1]?.fromUserDetailId, A);
  });

  test("refuses to discharge the same obligation half twice", async ({ assert }) => {
    const round = await MatchRound.create({ name: "Round", standLocation: "Kantina" });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const [a, b] = await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: A },
      { matchId: match.id, userDetailId: B },
    ]);
    const obligation = await MatchObligation.create({
      matchId: match.id,
      senderParticipantId: a!.id,
      receiverParticipantId: b!.id,
      itemId: ITEM_X,
    });

    await BookHandover.create({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserDetailId: A,
      toUserDetailId: B,
      occurredAt: DateTime.now(),
      dischargesSenderObligationId: obligation.id,
    });

    await BookHandover.create({
      blid: "BL0007654321",
      itemId: ITEM_X,
      fromUserDetailId: A,
      toUserDetailId: B,
      occurredAt: DateTime.now(),
      dischargesSenderObligationId: obligation.id,
    }).then(
      () => {
        throw new Error("expected the partial unique index to reject a second discharge");
      },
      () => undefined,
    );

    assert.lengthOf(await BookHandover.all(), 1);
  });
});

test.group("MatchRepository", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  async function seedUserMatch() {
    const round = await MatchRound.create({
      name: "Round",
      standLocation: "Kantina",
      status: "active",
    });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const [a, b] = await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: A },
      { matchId: match.id, userDetailId: B },
    ]);
    const obligation = await MatchObligation.create({
      matchId: match.id,
      senderParticipantId: a!.id,
      receiverParticipantId: b!.id,
      itemId: ITEM_X,
    });
    return { round, match, a: a!, b: b!, obligation };
  }

  test("finds a customer's matches with parties and obligations preloaded", async ({ assert }) => {
    const { match } = await seedUserMatch();

    const found = await MatchRepository.findForCustomer(A);

    assert.lengthOf(found, 1);
    assert.equal(found[0]?.id, match.id);
    assert.lengthOf(found[0]!.participants, 2);
    assert.lengthOf(found[0]!.obligations, 1);
    assert.equal(found[0]!.obligations[0]?.sender.userDetailId, A);
  });

  test("does not return matches the customer is not part of", async ({ assert }) => {
    await seedUserMatch();
    assert.lengthOf(await MatchRepository.findForCustomer(C), 0);
  });

  test("finds every match in a round", async ({ assert }) => {
    const { round, match } = await seedUserMatch();

    const found = await MatchRepository.findForRound(round.id);

    assert.lengthOf(found, 1);
    assert.equal(found[0]?.id, match.id);
  });

  test("returns a blid's custody chain oldest first", async ({ assert }) => {
    await BookHandover.createMany([
      {
        blid: "BL0001234567",
        itemId: ITEM_X,
        fromUserDetailId: A,
        toUserDetailId: B,
        occurredAt: DateTime.fromISO("2026-06-01T10:00:00Z"),
      },
      {
        blid: "BL0001234567",
        itemId: ITEM_X,
        fromUserDetailId: null,
        toUserDetailId: A,
        occurredAt: DateTime.fromISO("2026-01-05T10:00:00Z"),
      },
    ]);

    const chain = await MatchRepository.custodyChain("BL0001234567");

    assert.lengthOf(chain, 2);
    assert.isNull(chain[0]?.fromUserDetailId);
    assert.equal(chain[1]?.toUserDetailId, B);
  });

  test("records a handover that discharges both halves", async ({ assert }) => {
    const { obligation } = await seedUserMatch();

    const handover = await MatchRepository.recordHandover({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserDetailId: A,
      toUserDetailId: B,
      occurredAt: DateTime.fromISO("2026-06-01T10:00:00Z"),
      orderId: "5d765db5fc8c47001c408a01",
      dischargesSenderObligationId: obligation.id,
      dischargesReceiverObligationId: obligation.id,
    });

    const stored = await BookHandover.findOrFail(handover.id);
    assert.equal(stored.blid, "BL0001234567");
    assert.equal(stored.dischargesSenderObligationId, obligation.id);
    assert.equal(stored.dischargesReceiverObligationId, obligation.id);
  });

  test("records a handover that belongs to no match at all", async ({ assert }) => {
    const handover = await MatchRepository.recordHandover({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserDetailId: A,
      toUserDetailId: C,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: null,
      dischargesReceiverObligationId: null,
    });

    const stored = await BookHandover.findOrFail(handover.id);
    assert.isNull(stored.dischargesSenderObligationId);
    assert.isNull(stored.dischargesReceiverObligationId);
  });

  /** The same match shape as `seedUserMatch`, but in a round that is switched off. */
  async function seedDraftUserMatch() {
    const round = await MatchRound.create({
      name: "Old round",
      standLocation: "Kantina",
      status: "draft",
    });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const [a, b] = await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: A },
      { matchId: match.id, userDetailId: B },
    ]);
    const obligation = await MatchObligation.create({
      matchId: match.id,
      senderParticipantId: a!.id,
      receiverParticipantId: b!.id,
      itemId: ITEM_X,
    });
    return { round, match, obligation };
  }

  test("excludes matches in draft rounds from a customer's matches", async ({ assert }) => {
    await seedDraftUserMatch();
    const { match } = await seedUserMatch();

    const found = await MatchRepository.findForCustomer(A);

    assert.lengthOf(found, 1);
    assert.equal(found[0]?.id, match.id, "a switched-off round's match must not haunt the student");
  });

  test("discharges the active round's obligation, never a draft round's", async ({ assert }) => {
    // The draft obligation is older, so it would win the oldest-first ordering if the round
    // status were ignored — and its discharge would block the active one from ever settling.
    await seedDraftUserMatch();
    const { obligation } = await seedUserMatch();

    const senderObligation = await MatchRepository.findSenderObligation(A, ITEM_X);
    const receiverObligation = await MatchRepository.findReceiverObligation(B, ITEM_X);

    assert.equal(senderObligation?.id, obligation.id);
    assert.equal(receiverObligation?.id, obligation.id);
  });

  test("prefers the newest active round as the default", async ({ assert }) => {
    const active = await MatchRound.create({
      name: "Live",
      standLocation: "Kantina",
      status: "active",
    });
    await MatchRound.create({
      name: "Newer but still a draft",
      standLocation: "Kantina",
      status: "draft",
    });

    assert.equal((await MatchRepository.findDefaultRound())?.id, active.id);
  });

  test("falls back to the newest round when no round is active", async ({ assert }) => {
    await MatchRound.create({ name: "First", standLocation: "Kantina", status: "draft" });
    const last = await MatchRound.create({
      name: "Last",
      standLocation: "Kantina",
      status: "draft",
    });

    assert.equal((await MatchRepository.findDefaultRound())?.id, last.id);
  });

  test("knows when a customer has already received a title", async ({ assert }) => {
    const { obligation } = await seedUserMatch();

    assert.isFalse(await MatchRepository.hasReceivedTitle(B, ITEM_X));

    await MatchRepository.recordHandover({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserDetailId: A,
      toUserDetailId: B,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: null,
      dischargesReceiverObligationId: obligation.id,
    });

    assert.isTrue(await MatchRepository.hasReceivedTitle(B, ITEM_X));
  });

  test("recognises which obligation half a duplicate discharge collided on", async ({ assert }) => {
    const { obligation } = await seedUserMatch();
    const discharge = (blid: string) =>
      MatchRepository.recordHandover({
        blid,
        itemId: ITEM_X,
        fromUserDetailId: A,
        toUserDetailId: B,
        occurredAt: DateTime.now(),
        orderId: null,
        dischargesSenderObligationId: obligation.id,
        dischargesReceiverObligationId: null,
      });

    await discharge("BL0001234567");
    const error = await discharge("BL0007654321").then(
      () => null,
      (caught: unknown) => caught,
    );

    assert.isNotNull(error);
    assert.isTrue(isDischargeConflict(error, "sender"));
    assert.isFalse(isDischargeConflict(error, "receiver"));
  });

  test("rolls back and writes nothing when the obligation half is already discharged", async ({
    assert,
  }) => {
    const { obligation } = await seedUserMatch();
    await MatchRepository.recordHandover({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserDetailId: A,
      toUserDetailId: B,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: obligation.id,
      dischargesReceiverObligationId: null,
    });

    await MatchRepository.recordHandover({
      blid: "BL0007654321",
      itemId: ITEM_X,
      fromUserDetailId: A,
      toUserDetailId: B,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: obligation.id,
      dischargesReceiverObligationId: null,
    }).then(
      () => {
        throw new Error("expected the duplicate discharge to be rejected");
      },
      () => undefined,
    );

    assert.lengthOf(await BookHandover.all(), 1);
  });
});
