import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import BookHandover from "#models/book_handover";
import EmailVerification from "#models/email_verification";
import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import PasswordReset from "#models/password_reset";
import Signature from "#models/signature";
import User from "#models/user";
import { CustomerHaveActiveCustomerItems } from "#services/customer_items/customer_have_active_customer_items";
import { CustomerInvoiceActive } from "#services/invoices/customer_invoice_active";
import { OrderActive } from "#services/orders/order_active";
import { StorageService } from "#services/storage_service";
import { UserManagementService } from "#services/user_management_service";
import { createTestRound, seedTestCatalogue } from "#tests/matches/match-testing-utils";
import { createUser } from "#tests/user_fixtures";

const FROM = "5d765db5fc8c47001c408d81";
const TO = "5d765db5fc8c47001c408d82";
const OTHER = "5d765db5fc8c47001c408d83";
const ITEM_X = "5d765db5fc8c47001c408e01";

async function seedMatch(customerIds: string[]) {
  const round = await createTestRound({ name: "Round", standLocation: "Kantina" });
  const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
  const participants = await MatchParticipant.createMany(
    customerIds.map((userDetailId) => ({ matchId: match.id, userDetailId })),
  );
  return { match, participants };
}

test.group("UserManagementService.mergeUsers", (group) => {
  let sandbox: sinon.SinonSandbox;
  let customerItemsUpdateManyStub: sinon.SinonStub;
  let ordersUpdateManyStub: sinon.SinonStub;
  let invoicesUpdateManyStub: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(seedTestCatalogue);
  group.each.setup(async () => {
    await createUser({ id: FROM });
    await createUser({ id: TO });
    await createUser({ id: OTHER });
  });
  group.each.setup(() => {
    sandbox = createSandbox();
    customerItemsUpdateManyStub = sandbox
      .stub(StorageService.CustomerItems, "updateMany")
      .resolves();
    ordersUpdateManyStub = sandbox.stub(StorageService.Orders, "updateMany").resolves();
    invoicesUpdateManyStub = sandbox.stub(StorageService.Invoices, "updateMany").resolves();
    sandbox.stub(StorageService.Payments, "updateMany").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("repoints participants and handovers at the surviving user", async ({ assert }) => {
    const { match } = await seedMatch([FROM, OTHER]);
    await BookHandover.create({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserDetailId: FROM,
      toUserDetailId: OTHER,
      occurredAt: DateTime.now(),
    });

    await UserManagementService.mergeUsers(FROM, TO);

    const participants = await MatchParticipant.query().where("matchId", match.id);
    assert.sameMembers(
      participants.map((participant) => participant.userDetailId),
      [TO, OTHER],
    );
    assert.equal((await BookHandover.firstOrFail()).fromUserDetailId, TO);
  });

  test("moves signatures onto the surviving user", async ({ assert }) => {
    await Signature.create({
      customerDetailsId: FROM,
      signingName: "Test Testersen",
      signedByGuardian: false,
      image: Buffer.from("webp"),
    });

    await UserManagementService.mergeUsers(FROM, TO);

    assert.equal((await Signature.firstOrFail()).customerDetailsId, TO);
  });

  test("when both users are in the same match, obligations move to the surviving participant", async ({
    assert,
  }) => {
    const { match, participants } = await seedMatch([FROM, TO, OTHER]);
    const [fromParticipant, toParticipant, otherParticipant] = participants;
    const obligationToOther = await MatchObligation.create({
      matchId: match.id,
      itemId: ITEM_X,
      senderParticipantId: fromParticipant!.id,
      receiverParticipantId: otherParticipant!.id,
    });

    await UserManagementService.mergeUsers(FROM, TO);

    const remaining = await MatchParticipant.query().where("matchId", match.id);
    assert.sameMembers(
      remaining.map((participant) => participant.userDetailId),
      [TO, OTHER],
    );
    const updatedObligation = await MatchObligation.findOrFail(obligationToOther.id);
    assert.equal(updatedObligation.senderParticipantId, toParticipant!.id);
  });

  test("an obligation between the two merged users is deleted, not self-pointed", async ({
    assert,
  }) => {
    const { match, participants } = await seedMatch([FROM, TO]);
    const [fromParticipant, toParticipant] = participants;
    await MatchObligation.create({
      matchId: match.id,
      itemId: ITEM_X,
      senderParticipantId: fromParticipant!.id,
      receiverParticipantId: toParticipant!.id,
    });

    await UserManagementService.mergeUsers(FROM, TO);

    const remaining = await MatchParticipant.query().where("matchId", match.id);
    assert.lengthOf(remaining, 1);
    assert.equal(remaining[0]?.userDetailId, TO);
    assert.lengthOf(await MatchObligation.query().where("matchId", match.id), 0);
  });

  test("moves mongo references and deletes the source user", async ({ assert }) => {
    await UserManagementService.mergeUsers(FROM, TO);

    assert.isTrue(
      customerItemsUpdateManyStub.calledWithMatch({ customer: FROM }, { customer: TO }),
    );
    assert.isTrue(ordersUpdateManyStub.calledWithMatch({ customer: FROM }, { customer: TO }));
    assert.isTrue(
      invoicesUpdateManyStub.calledWithMatch(
        { "customerInfo.userDetail": FROM },
        { "customerInfo.userDetail": TO },
      ),
    );
    assert.isNull(await User.find(FROM));
    assert.isNotNull(await User.find(TO));
  });

  test("removes the source user's verification and password reset rows", async ({ assert }) => {
    await EmailVerification.create({ userDetailId: FROM });
    await EmailVerification.create({ userDetailId: TO });
    await PasswordReset.create({ userDetailId: FROM, tokenHash: "hash" });

    await UserManagementService.mergeUsers(FROM, TO);

    assert.lengthOf(await EmailVerification.query().where("userDetailId", FROM), 0);
    assert.lengthOf(await EmailVerification.query().where("userDetailId", TO), 1);
    assert.lengthOf(await PasswordReset.query().where("userDetailId", FROM), 0);
  });

  test("refuses to merge a user with itself", async ({ assert }) => {
    await assert.rejects(() => UserManagementService.mergeUsers(FROM, FROM));
  });

  test("refuses to merge employees or admins", async ({ assert }) => {
    await User.query().where("id", FROM).update({ permission: "admin" });
    await assert.rejects(() => UserManagementService.mergeUsers(FROM, TO));
    assert.isNotNull(await User.find(FROM));
  });
});

test.group("UserManagementService.deleteUser", (group) => {
  let sandbox: sinon.SinonSandbox;
  let activeOrdersStub: sinon.SinonStub;
  let activeCustomerItemsStub: sinon.SinonStub;
  let activeInvoicesStub: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(seedTestCatalogue);
  group.each.setup(async () => {
    await createUser({ id: FROM });
  });
  group.each.setup(() => {
    sandbox = createSandbox();
    activeOrdersStub = sandbox.stub(OrderActive.prototype, "haveActiveOrders").resolves(false);
    activeCustomerItemsStub = sandbox
      .stub(CustomerHaveActiveCustomerItems.prototype, "haveActiveCustomerItems")
      .resolves(false);
    activeInvoicesStub = sandbox
      .stub(CustomerInvoiceActive.prototype, "haveActiveInvoices")
      .resolves(false);
  });
  group.each.teardown(() => sandbox.restore());

  test("deletes the user with their auth artifacts and signatures", async ({ assert }) => {
    await EmailVerification.create({ userDetailId: FROM });
    await PasswordReset.create({ userDetailId: FROM, tokenHash: "hash" });
    await Signature.create({
      customerDetailsId: FROM,
      signingName: "Test Testersen",
      signedByGuardian: false,
      image: Buffer.from("webp"),
    });

    await UserManagementService.deleteUser(FROM);

    assert.isNull(await User.find(FROM));
    assert.lengthOf(await EmailVerification.query().where("userDetailId", FROM), 0);
    assert.lengthOf(await PasswordReset.query().where("userDetailId", FROM), 0);
    assert.lengthOf(await Signature.query().where("customerDetailsId", FROM), 0);
  });

  test("refuses while the customer has a match obligation no handover has discharged", async ({
    assert,
  }) => {
    await createUser({ id: OTHER });
    const { match, participants } = await seedMatch([FROM, OTHER]);
    await MatchObligation.create({
      matchId: match.id,
      itemId: ITEM_X,
      senderParticipantId: participants[0]!.id,
      receiverParticipantId: participants[1]!.id,
    });

    await assert.rejects(
      () => UserManagementService.deleteUser(FROM),
      "Kunden har aktive overleveringer og kan ikke slettes",
    );
    assert.isNotNull(await User.find(FROM));
    assert.lengthOf(await MatchParticipant.query().where("matchId", match.id), 2);
  });

  test("keeps the match but drops the participation once every obligation is settled", async ({
    assert,
  }) => {
    await createUser({ id: OTHER });
    const { match, participants } = await seedMatch([FROM, OTHER]);
    const obligation = await MatchObligation.create({
      matchId: match.id,
      itemId: ITEM_X,
      senderParticipantId: participants[0]!.id,
      receiverParticipantId: participants[1]!.id,
    });
    await BookHandover.create({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserDetailId: FROM,
      toUserDetailId: OTHER,
      occurredAt: DateTime.now(),
      dischargesSenderObligationId: obligation.id,
      dischargesReceiverObligationId: obligation.id,
    });

    await UserManagementService.deleteUser(FROM);

    assert.isNotNull(await Match.find(match.id));
    const remaining = await MatchParticipant.query().where("matchId", match.id);
    assert.deepEqual(
      remaining.map((participant) => participant.userDetailId),
      [OTHER],
    );
    const handover = await BookHandover.query().where("itemId", ITEM_X).firstOrFail();
    assert.isNull(handover.fromUserDetailId);
    assert.isNull(handover.dischargesSenderObligationId);
  });

  test("refuses when the customer has active orders", async ({ assert }) => {
    activeOrdersStub.resolves(true);
    await assert.rejects(() => UserManagementService.deleteUser(FROM));
    assert.isNotNull(await User.find(FROM));
  });

  test("refuses when the customer has active customer items", async ({ assert }) => {
    activeCustomerItemsStub.resolves(true);
    await assert.rejects(() => UserManagementService.deleteUser(FROM));
    assert.isNotNull(await User.find(FROM));
  });

  test("refuses when the customer has active invoices", async ({ assert }) => {
    activeInvoicesStub.resolves(true);
    await assert.rejects(() => UserManagementService.deleteUser(FROM));
    assert.isNotNull(await User.find(FROM));
  });

  test("refuses to delete employees or admins", async ({ assert }) => {
    await User.query().where("id", FROM).update({ permission: "employee" });
    await assert.rejects(() => UserManagementService.deleteUser(FROM));
    assert.isNotNull(await User.find(FROM));
  });
});
