import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import { createTestRound } from "#tests/matches/match-testing-utils";
import { MatchRepository } from "#services/matches/match_repository";
import { toMatchDtos } from "#transformers/match_transformer";
import type { MatchLookups } from "#transformers/match_transformer";

const A = "5d765db5fc8c47001c408d81";
const B = "5d765db5fc8c47001c408d82";
const C = "5d765db5fc8c47001c408d83";
const ITEM_X = "5d765db5fc8c47001c408e01";
const OWN_COPY = "BL0001234567";
const OTHER_COPY = "BL0007654321";

const lookups: MatchLookups = {
  people: new Map([
    [A, { name: "Kari Hansen", phone: "11111111", email: "kari@example.no" }],
    [B, { name: "Ola Nordmann", phone: "22222222", email: "ola@example.no" }],
    [C, { name: "Per Berg", phone: "33333333", email: "per@example.no" }],
  ]),
  titles: new Map([[ITEM_X, "Matematikk R1"]]),
};

async function render() {
  const matches = await Match.query()
    .preload("participants", (participants) => participants.orderBy("id", "asc"))
    .preload("obligations", (obligations) => {
      void obligations.preload("sender").preload("receiver");
    });
  const obligationIds = matches.flatMap((match) => match.obligations.map((o) => o.id));
  const handovers = await MatchRepository.handoversForObligations(obligationIds);
  return toMatchDtos(matches, handovers, lookups);
}

test.group("toMatchDtos", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  async function seedUserMatch() {
    const round = await createTestRound({ name: "Round", standLocation: "Kantina" });
    const match = await Match.create({
      roundId: round.id,
      meetingLocation: "Biblioteket",
      meetingTime: DateTime.fromISO("2026-06-01T10:00:00Z"),
    });
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

  test("names both parties and the title", async ({ assert }) => {
    const { match, round } = await seedUserMatch();

    const [dto] = await render();

    assert.equal(dto?.id, String(match.id));
    assert.equal(dto?.roundId, String(round.id));
    assert.isFalse(dto?.isStandMatch);
    // Compare the instant, not the rendered offset: the DTO carries a zoned ISO string, so
    // pinning the literal would make this test fail on a machine in another timezone.
    assert.equal(
      DateTime.fromISO(dto!.meetingTime!).toMillis(),
      DateTime.fromISO("2026-06-01T10:00:00Z").toMillis(),
    );
    assert.lengthOf(dto!.participants, 2);
    assert.deepEqual(dto!.obligations[0]?.sender, {
      kind: "customer",
      customerId: A,
      name: "Kari Hansen",
      phone: "11111111",
      email: "kari@example.no",
    });
    assert.equal(dto!.obligations[0]?.title, "Matematikk R1");
    assert.isNull(dto!.obligations[0]?.senderHandover);
    assert.isNull(dto!.obligations[0]?.receiverHandover);
  });

  test("renders the stand as a party rather than a missing customer", async ({ assert }) => {
    const round = await createTestRound({ name: "Round", standLocation: "Kantina" });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Kantina" });
    const [customer, stand] = await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: A },
      { matchId: match.id, userDetailId: null },
    ]);
    await MatchObligation.create({
      matchId: match.id,
      senderParticipantId: stand!.id,
      receiverParticipantId: customer!.id,
      itemId: ITEM_X,
    });

    const [dto] = await render();

    assert.isTrue(dto?.isStandMatch);
    assert.isNull(dto?.meetingTime);
    assert.deepEqual(dto!.obligations[0]?.sender, { kind: "stand" });
    assert.equal(dto!.obligations[0]?.receiver.kind, "customer");
  });

  test("attaches a handover that discharged both halves to both sides", async ({ assert }) => {
    const { obligation } = await seedUserMatch();
    await MatchRepository.recordHandover({
      blid: OWN_COPY,
      itemId: ITEM_X,
      fromUserDetailId: A,
      toUserDetailId: B,
      occurredAt: DateTime.fromISO("2026-06-01T10:05:00Z"),
      orderId: null,
      dischargesSenderObligationId: obligation.id,
      dischargesReceiverObligationId: obligation.id,
    });

    const [dto] = await render();
    const rendered = dto!.obligations[0]!;

    assert.equal(rendered.senderHandover?.blid, OWN_COPY);
    assert.equal(rendered.senderHandover?.id, rendered.receiverHandover?.id);
    assert.deepEqual(rendered.senderHandover?.to, {
      kind: "customer",
      customerId: B,
      name: "Ola Nordmann",
      phone: "22222222",
      email: "ola@example.no",
    });
  });

  test("keeps the two halves apart when different events discharged them", async ({ assert }) => {
    // The case the old model could not represent: B was served by C, while A's own copy is still
    // outstanding. A is not discharged, and the UI must be able to name C.
    const { obligation } = await seedUserMatch();
    await MatchRepository.recordHandover({
      blid: OTHER_COPY,
      itemId: ITEM_X,
      fromUserDetailId: C,
      toUserDetailId: B,
      occurredAt: DateTime.fromISO("2026-06-01T10:05:00Z"),
      orderId: null,
      dischargesSenderObligationId: null,
      dischargesReceiverObligationId: obligation.id,
    });

    const [dto] = await render();
    const rendered = dto!.obligations[0]!;

    assert.isNull(rendered.senderHandover);
    assert.equal(rendered.receiverHandover?.blid, OTHER_COPY);
    assert.deepEqual(rendered.receiverHandover?.from, {
      kind: "customer",
      customerId: C,
      name: "Per Berg",
      phone: "33333333",
      email: "per@example.no",
    });
  });

  test("renders an unknown customer as blank rather than throwing", async ({ assert }) => {
    // getAllMatches must keep working for deleted or inactive user details.
    const round = await createTestRound({ name: "Round", standLocation: "Kantina" });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    const [a, b] = await MatchParticipant.createMany([
      { matchId: match.id, userDetailId: "5d765db5fc8c47001c408dff" },
      { matchId: match.id, userDetailId: B },
    ]);
    await MatchObligation.create({
      matchId: match.id,
      senderParticipantId: a!.id,
      receiverParticipantId: b!.id,
      itemId: "5d765db5fc8c47001c408eff",
    });

    const [dto] = await render();

    assert.deepEqual(dto!.obligations[0]?.sender, {
      kind: "customer",
      customerId: "5d765db5fc8c47001c408dff",
      name: "",
      phone: "",
      email: "",
    });
    assert.equal(dto!.obligations[0]?.title, "Ukjent bok");
  });
});
