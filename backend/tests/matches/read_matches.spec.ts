import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import sinon, { createSandbox } from "sinon";

import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import MatchRound from "#models/match_round";
import { MatchRepository } from "#services/matches/match_repository";
import { getMatchesForCustomer, getMatchesForRound } from "#services/matches/read_matches";
import { StorageService } from "#services/storage_service";
import { USER_PERMISSION } from "#shared/user-permission";

const A = "5d765db5fc8c47001c408d81";
const B = "5d765db5fc8c47001c408d82";
/** Outside the match: the student who actually handed a book over. */
const OUTSIDER = "5d765db5fc8c47001c408d99";
const ITEM_X = "5d765db5fc8c47001c408e01";

test.group("read matches", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());
  group.each.setup(() => testUtils.db().truncate());

  function stubMongo() {
    sandbox.stub(StorageService.UserDetails, "getMany").callsFake(async (ids) => {
      return [
        { id: A, name: "Kari Hansen", phone: "1", email: "kari@x.no" },
        { id: B, name: "Ola Nordmann", phone: "2", email: "ola@x.no" },
        { id: OUTSIDER, name: "Per Berg", phone: "3", email: "per@x.no" },
      ].filter((person) => ids.includes(person.id)) as never;
    });
    sandbox
      .stub(StorageService.Items, "getMany")
      .resolves([{ id: ITEM_X, title: "Matematikk R1" }] as never);
  }

  async function seed() {
    // Explicitly active: students only see rounds that are switched on.
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
    return { round, match, obligation };
  }

  test("returns a customer's matches with names and titles filled in", async ({ assert }) => {
    stubMongo();
    await seed();

    const matches = await getMatchesForCustomer(A);

    assert.lengthOf(matches, 1);
    assert.equal(matches[0]?.obligations[0]?.title, "Matematikk R1");
    assert.deepEqual(matches[0]?.obligations[0]?.sender, {
      kind: "customer",
      customerId: A,
      name: "Kari Hansen",
      phone: "1",
      email: "kari@x.no",
    });
  });

  test("names a handover counterparty from outside the match", async ({ assert }) => {
    // The reason handovers record a counterparty at all: B was served by someone they were not
    // matched with, and the UI has to be able to say who.
    stubMongo();
    const { obligation } = await seed();
    await MatchRepository.recordHandover({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserDetailId: OUTSIDER,
      toUserDetailId: B,
      occurredAt: DateTime.now(),
      orderId: null,
      dischargesSenderObligationId: null,
      dischargesReceiverObligationId: obligation.id,
    });

    const matches = await getMatchesForCustomer(B);

    assert.deepEqual(matches[0]?.obligations[0]?.receiverHandover?.from, {
      kind: "customer",
      customerId: OUTSIDER,
      name: "Per Berg",
      phone: "3",
      email: "per@x.no",
    });
    // A is still on the hook: their own book has not moved.
    assert.isNull(matches[0]?.obligations[0]?.senderHandover);
  });

  test("returns nothing for a customer with no matches", async ({ assert }) => {
    stubMongo();
    await seed();

    assert.lengthOf(await getMatchesForCustomer(OUTSIDER), 0);
  });

  test("defaults to the newest active round when none is named", async ({ assert }) => {
    stubMongo();
    await seed();
    const newer = await MatchRound.create({
      name: "Newer",
      standLocation: "Kantina",
      status: "active",
    });
    await Match.create({ roundId: newer.id, meetingLocation: "Nyeste" });
    // Newer still, but a draft — being newest must not make an unchecked round the default.
    const draft = await MatchRound.create({ name: "Draft", standLocation: "Kantina" });
    await Match.create({ roundId: draft.id, meetingLocation: "Utkastet" });

    const matches = await getMatchesForRound();

    assert.lengthOf(matches, 1);
    assert.equal(matches[0]?.meetingLocation, "Nyeste");
  });

  test("returns the named round rather than the newest", async ({ assert }) => {
    stubMongo();
    const { round } = await seed();
    const newer = await MatchRound.create({ name: "Newer", standLocation: "Kantina" });
    await Match.create({ roundId: newer.id, meetingLocation: "Nyeste" });

    const matches = await getMatchesForRound(round.id);

    assert.lengthOf(matches, 1);
    assert.equal(matches[0]?.meetingLocation, "Biblioteket");
  });

  test("returns nothing rather than throwing for an unknown round", async ({ assert }) => {
    stubMongo();
    assert.lengthOf(await getMatchesForRound(999_999), 0);
  });

  test("reads people and items with admin permission so inactive ones keep rendering", async ({
    assert,
  }) => {
    // getMany without a permission filters on `active: true`; a student or item deactivated
    // mid-round would silently vanish from their own matches.
    stubMongo();
    await seed();

    await getMatchesForCustomer(A);

    assert.equal(
      (StorageService.UserDetails.getMany as sinon.SinonStub).firstCall.args[1],
      USER_PERMISSION.ADMIN,
    );
    assert.equal(
      (StorageService.Items.getMany as sinon.SinonStub).firstCall.args[1],
      USER_PERMISSION.ADMIN,
    );
  });

  test("reads Mongo once per collection however many matches there are", async ({ assert }) => {
    stubMongo();
    const { round } = await seed();
    const second = await Match.create({ roundId: round.id, meetingLocation: "Andre" });
    const [c, d] = await MatchParticipant.createMany([
      { matchId: second.id, userDetailId: OUTSIDER },
      { matchId: second.id, userDetailId: null },
    ]);
    await MatchObligation.create({
      matchId: second.id,
      senderParticipantId: c!.id,
      receiverParticipantId: d!.id,
      itemId: ITEM_X,
    });

    await getMatchesForRound(round.id);

    assert.equal((StorageService.UserDetails.getMany as sinon.SinonStub).callCount, 1);
    assert.equal((StorageService.Items.getMany as sinon.SinonStub).callCount, 1);
  });
});
