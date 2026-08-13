import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import sinon, { createSandbox } from "sinon";
import { DateTime } from "luxon";

import BookHandover from "#models/book_handover";
import Match from "#models/match";
import MatchParticipant from "#models/match_participant";
import { createTestRound } from "#tests/matches/match-testing-utils";
import { DeleteUserService } from "#services/legacy/collections/user-detail/helpers/delete-user-service";
import { StorageService } from "#services/storage_service";

const FROM = "5d765db5fc8c47001c408d81";
const TO = "5d765db5fc8c47001c408d82";
const OTHER = "5d765db5fc8c47001c408d83";
const ITEM_X = "5d765db5fc8c47001c408e01";

test.group("DeleteUserService match merge", (group) => {
  const service = new DeleteUserService();
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox
      .stub(StorageService.UserDetails, "get")
      .resolves({ orders: [], customerItems: [], signatures: [] } as never);
    sandbox.stub(StorageService.UserDetails, "update").resolves();
    sandbox.stub(StorageService.CustomerItems, "updateMany").resolves();
    sandbox.stub(StorageService.Invoices, "updateMany").resolves();
    sandbox.stub(StorageService.Orders, "updateMany").resolves();
    sandbox.stub(StorageService.Payments, "updateMany").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  async function seedMatch(customerIds: string[]) {
    const round = await createTestRound({ name: "Round", standLocation: "Kantina" });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    await MatchParticipant.createMany(
      customerIds.map((userDetailId) => ({ matchId: match.id, userDetailId })),
    );
    return match;
  }

  test("repoints participants and handovers at the surviving user", async ({ assert }) => {
    const match = await seedMatch([FROM, OTHER]);
    await BookHandover.create({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserDetailId: FROM,
      toUserDetailId: OTHER,
      occurredAt: DateTime.now(),
    });

    await service.mergeIntoOtherUser(FROM, TO);

    const participants = await MatchParticipant.query().where("matchId", match.id);
    assert.sameMembers(
      participants.map((participant) => participant.userDetailId),
      [TO, OTHER],
    );
    assert.equal((await BookHandover.firstOrFail()).fromUserDetailId, TO);
  });
});
