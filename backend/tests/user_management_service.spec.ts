import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import sinon, { createSandbox } from "sinon";

import BookHandover from "#models/book_handover";
import EmailVerification from "#models/email_verification";
import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import PasswordReset from "#models/password_reset";
import Signature from "#models/signature";
import { CustomerHaveActiveCustomerItems } from "#services/legacy/collections/customer-item/helpers/customer-have-active-customer-items";
import { CustomerInvoiceActive } from "#services/legacy/collections/invoice/helpers/customer-invoice-active";
import { OrderActive } from "#services/legacy/collections/order/helpers/order-active/order-active";
import { StorageService } from "#services/storage_service";
import { UserManagementService } from "#services/user_management_service";
import { createTestRound } from "#tests/matches/match-testing-utils";
import { User } from "#types/user";
import { asStub, mock, unchecked } from "#tests/test-doubles";

const FROM = "5d765db5fc8c47001c408d81";
const TO = "5d765db5fc8c47001c408d82";
const OTHER = "5d765db5fc8c47001c408d83";
const ITEM_X = "5d765db5fc8c47001c408e01";
const FROM_USER_ID = "5d765db5fc8c47001c408f01";
const TO_USER_ID = "5d765db5fc8c47001c408f02";

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
  let detailsUpdateStub: sinon.SinonStub;
  let detailsRemoveStub: sinon.SinonStub;
  let usersRemoveStub: sinon.SinonStub;
  let customerItemsUpdateManyStub: sinon.SinonStub;
  let ordersUpdateManyStub: sinon.SinonStub;
  let invoicesUpdateManyStub: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.UserDetails, "getOrNull").callsFake(async (id) =>
      unchecked({
        id,
        orders: id === FROM ? ["order-from"] : ["order-to"],
        customerItems: id === FROM ? ["ci-from", "ci-shared"] : ["ci-to", "ci-shared"],
      }),
    );
    sandbox.stub(StorageService.Users, "getByQuery").callsFake(async (query) => {
      const detailsId = query.stringFilters?.[0]?.value;
      return [
        mock<User>({
          id: detailsId === FROM ? FROM_USER_ID : TO_USER_ID,
          userDetail: detailsId,
          permission: "customer",
        }),
      ];
    });
    detailsUpdateStub = sandbox.stub(StorageService.UserDetails, "update").resolves();
    detailsRemoveStub = sandbox.stub(StorageService.UserDetails, "remove").resolves();
    usersRemoveStub = sandbox.stub(StorageService.Users, "remove").resolves();
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

  test("moves mongo references, merges detail arrays and deletes the source user", async ({
    assert,
  }) => {
    await UserManagementService.mergeUsers(FROM, TO);

    assert.deepEqual(detailsUpdateStub.firstCall.args[0], TO);
    assert.sameMembers(detailsUpdateStub.firstCall.args[1].customerItems, [
      "ci-from",
      "ci-shared",
      "ci-to",
    ]);
    assert.sameMembers(detailsUpdateStub.firstCall.args[1].orders, ["order-from", "order-to"]);
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
    assert.isTrue(usersRemoveStub.calledWith(FROM_USER_ID));
    assert.isTrue(detailsRemoveStub.calledWith(FROM));
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
    asStub(StorageService.Users.getByQuery).callsFake(async () => [
      mock<User>({ id: FROM_USER_ID, userDetail: FROM, permission: "admin" }),
    ]);
    await assert.rejects(() => UserManagementService.mergeUsers(FROM, TO));
  });
});

test.group("UserManagementService.deleteUser", (group) => {
  let sandbox: sinon.SinonSandbox;
  let detailsRemoveStub: sinon.SinonStub;
  let usersRemoveStub: sinon.SinonStub;
  let activeOrdersStub: sinon.SinonStub;
  let activeCustomerItemsStub: sinon.SinonStub;
  let activeInvoicesStub: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.UserDetails, "getOrNull").resolves(unchecked({ id: FROM }));
    sandbox
      .stub(StorageService.Users, "getByQuery")
      .resolves([mock<User>({ id: FROM_USER_ID, userDetail: FROM, permission: "customer" })]);
    detailsRemoveStub = sandbox.stub(StorageService.UserDetails, "remove").resolves();
    usersRemoveStub = sandbox.stub(StorageService.Users, "remove").resolves();
    activeOrdersStub = sandbox.stub(OrderActive.prototype, "haveActiveOrders").resolves(false);
    activeCustomerItemsStub = sandbox
      .stub(CustomerHaveActiveCustomerItems.prototype, "haveActiveCustomerItems")
      .resolves(false);
    activeInvoicesStub = sandbox
      .stub(CustomerInvoiceActive.prototype, "haveActiveInvoices")
      .resolves(false);
  });
  group.each.teardown(() => sandbox.restore());

  test("deletes the login, the details and auth artifacts", async ({ assert }) => {
    await EmailVerification.create({ userDetailId: FROM });
    await PasswordReset.create({ userDetailId: FROM, tokenHash: "hash" });

    await UserManagementService.deleteUser(FROM);

    assert.isTrue(usersRemoveStub.calledWith(FROM_USER_ID));
    assert.isTrue(detailsRemoveStub.calledWith(FROM));
    assert.lengthOf(await EmailVerification.query().where("userDetailId", FROM), 0);
    assert.lengthOf(await PasswordReset.query().where("userDetailId", FROM), 0);
  });

  test("refuses when the customer has active orders", async ({ assert }) => {
    activeOrdersStub.resolves(true);
    await assert.rejects(() => UserManagementService.deleteUser(FROM));
    assert.isFalse(detailsRemoveStub.called);
  });

  test("refuses when the customer has active customer items", async ({ assert }) => {
    activeCustomerItemsStub.resolves(true);
    await assert.rejects(() => UserManagementService.deleteUser(FROM));
    assert.isFalse(detailsRemoveStub.called);
  });

  test("refuses when the customer has active invoices", async ({ assert }) => {
    activeInvoicesStub.resolves(true);
    await assert.rejects(() => UserManagementService.deleteUser(FROM));
    assert.isFalse(detailsRemoveStub.called);
  });

  test("refuses to delete employees or admins", async ({ assert }) => {
    asStub(StorageService.Users.getByQuery).resolves([
      mock<User>({ id: FROM_USER_ID, userDetail: FROM, permission: "employee" }),
    ]);
    await assert.rejects(() => UserManagementService.deleteUser(FROM));
    assert.isFalse(detailsRemoveStub.called);
  });
});
