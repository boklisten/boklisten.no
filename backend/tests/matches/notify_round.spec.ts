import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import sinon, { createSandbox } from "sinon";

import Match from "#models/match";
import MatchParticipant from "#models/match_participant";
import MatchRound from "#models/match_round";
import DispatchService from "#services/dispatch_service";
import { notify } from "#services/matches/notify_round";
import { StorageService } from "#services/storage_service";

const A = "5d765db5fc8c47001c408d81";
const B = "5d765db5fc8c47001c408d82";
const C = "5d765db5fc8c47001c408d83";
const D = "5d765db5fc8c47001c408d84";

test.group("notify", (group) => {
  let sandbox: sinon.SinonSandbox;
  let getManyStub: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(DispatchService, "sendMatchInformation").resolves({
      mailStatus: { success: true },
      smsStatus: { successCount: 0, failed: [] },
    } as never);
    getManyStub = sandbox
      .stub(StorageService.UserDetails, "getMany")
      .callsFake(async (ids) => ids.map((id) => ({ id })) as never);
  });
  group.each.teardown(() => sandbox.restore());

  async function seedRoundWithUserMatch(customerIds: string[], status = "active") {
    const round = await MatchRound.create({ name: "Round", standLocation: "Kantina", status });
    const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
    await MatchParticipant.createMany(
      customerIds.map((userDetailId) => ({ matchId: match.id, userDetailId })),
    );
    return round;
  }

  test("messages the named round rather than the default one", async ({ assert }) => {
    const oldRound = await seedRoundWithUserMatch([A, B]);
    await seedRoundWithUserMatch([C, D]);

    await notify({ target: "all", message: "Husk overleveringen!", roundId: oldRound.id });

    assert.sameMembers(getManyStub.firstCall.args[0] as string[], [A, B]);
  });

  test("defaults to the newest active round", async ({ assert }) => {
    await seedRoundWithUserMatch([A, B]);
    await seedRoundWithUserMatch([C, D], "draft");

    await notify({ target: "all", message: "Husk overleveringen!" });

    assert.sameMembers(getManyStub.firstCall.args[0] as string[], [A, B]);
  });

  test("refuses to message a draft round", async ({ assert }) => {
    // Students cannot see a draft, so a message about it would point them at nothing.
    const draft = await seedRoundWithUserMatch([A, B], "draft");

    await notify({ target: "all", message: "Husk overleveringen!", roundId: draft.id }).then(
      () => {
        throw new Error("expected notify to refuse a draft round");
      },
      () => undefined,
    );

    assert.isTrue(getManyStub.notCalled);
  });
});
