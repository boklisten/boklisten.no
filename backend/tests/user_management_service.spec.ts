import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import CustomerItem from "#models/customer_item";
import Invoice from "#models/invoice";
import BookHandover from "#models/book_handover";
import EmailVerification from "#models/email_verification";
import Match from "#models/match";
import MatchObligation from "#models/match_obligation";
import MatchParticipant from "#models/match_participant";
import Order from "#models/order";
import Signature from "#models/signature";
import User from "#models/user";
import { SessionRevocationService } from "#services/session_revocation_service";
import { UserManagementService } from "#services/user_management_service";
import { rejectionStatus } from "#tests/fixtures";
import { createBranch, rootBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createInvoice } from "#tests/invoice_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createTestRound, seedTestCatalogue } from "#tests/matches/match-testing-utils";
import { createOrder } from "#tests/order_fixtures";
import { createPayment } from "#tests/payment_fixtures";
import { createUser, userDouble } from "#tests/user_fixtures";

/** Head office: homed at the root like every admin. */
const ADMIN = userDouble({ permission: "admin" });
/** A manager homed at the root, so scope never gets in the way of the level tests. */
const MANAGER = userDouble({ permission: "manager" });

const FROM = "5d765db5fc8c47001c408d81";
const TO = "5d765db5fc8c47001c408d82";
const OTHER = "5d765db5fc8c47001c408d83";
const ITEM_X = "5d765db5fc8c47001c408e01";

async function seedMatch(customerIds: string[]) {
  const round = await createTestRound({ name: "Round", standLocation: "Kantina" });
  const match = await Match.create({ roundId: round.id, meetingLocation: "Biblioteket" });
  const participants = await MatchParticipant.createMany(
    customerIds.map((userId) => ({ matchId: match.id, userId })),
  );
  return { match, participants };
}

test.group("UserManagementService.getEmployees", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("lists the staff above, on and below the node by name, never customers or siblings", async ({
    assert,
  }) => {
    const root = await rootBranch();
    const school = await createBranch({ name: "Ullern" });
    const klass = await createBranch({ parentBranchId: school.id });
    const sibling = await createBranch({ name: "Nydalen" });
    const atSchool = await createUser({
      name: "Zara",
      permission: "employee",
      employeeBranchId: school.id,
    });
    const atClass = await createUser({
      name: "Anne",
      permission: "employee",
      employeeBranchId: klass.id,
    });
    const admin = await createUser({ name: "Mona", permission: "admin" });
    await createUser({ name: "Per", permission: "employee", employeeBranchId: sibling.id });
    await createUser({ name: "Kunde", permission: "customer", branchMembershipId: klass.id });

    const atUllern = await UserManagementService.getEmployees(school.id);
    assert.deepEqual(
      atUllern.map((row) => [row.userId, row.relation]),
      [
        [atClass.id, "below"],
        [admin.id, "above"],
        [atSchool.id, "here"],
      ],
    );
    assert.equal(atUllern[0]?.employeeBranchId, klass.id);

    const atRoot = await UserManagementService.getEmployees(root.id);
    assert.lengthOf(atRoot, 4);
    assert.equal(atRoot.find((row) => row.userId === admin.id)?.relation, "here");
    assert.notInclude(
      atRoot.map((row) => row.relation),
      "above",
    );
  });
});

test.group("UserManagementService.setPermission", (group) => {
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());

  test("ends the sessions of users whose level changes, not of one who only moves node", async ({
    assert,
  }) => {
    const revoke = sandbox.stub(SessionRevocationService, "revokeAll").resolves();
    const ullern = await createBranch({ name: "Ullern" });
    const promoted = await createUser();
    const moved = await createUser({ permission: "employee" });

    await UserManagementService.setPermission(
      ADMIN,
      [promoted.id, moved.id],
      "employee",
      ullern.id,
    );

    assert.deepEqual(
      revoke.getCalls().map((call) => call.args[0]),
      [promoted.id],
    );
    assert.equal((await User.findOrFail(moved.id)).employeeBranchId, ullern.id);
  });

  test("homes an employee at the given branch and keeps it when none is given", async ({
    assert,
  }) => {
    const ullern = await createBranch({ name: "Ullern" });
    const user = await createUser();

    await UserManagementService.setPermission(ADMIN, [user.id], "employee", ullern.id);
    assert.equal((await User.findOrFail(user.id)).employeeBranchId, ullern.id);

    await UserManagementService.setPermission(ADMIN, [user.id], "employee");
    assert.equal((await User.findOrFail(user.id)).employeeBranchId, ullern.id);
  });

  test("an admin always works from the root, whatever branch is given", async ({ assert }) => {
    const ullern = await createBranch({ name: "Ullern" });
    const user = await createUser({ permission: "employee", employeeBranchId: ullern.id });

    await UserManagementService.setPermission(ADMIN, [user.id], "admin", ullern.id);

    const admin = await User.findOrFail(user.id);
    assert.equal(admin.permission, "admin");
    assert.equal(admin.employeeBranchId, (await rootBranch()).id);
  });

  test("demoting to customer resets the home node to the root", async ({ assert }) => {
    const ullern = await createBranch({ name: "Ullern" });
    const user = await createUser({ permission: "employee", employeeBranchId: ullern.id });

    await UserManagementService.setPermission(ADMIN, [user.id], "customer");

    assert.equal((await User.findOrFail(user.id)).employeeBranchId, (await rootBranch()).id);
  });

  test("refuses a branch that does not exist", async ({ assert }) => {
    const user = await createUser();

    await assert.rejects(
      () =>
        UserManagementService.setPermission(
          ADMIN,
          [user.id],
          "employee",
          "000000000000000000000bad",
        ),
      /Fant ingen filial/,
    );
    assert.equal((await User.findOrFail(user.id)).permission, "customer");
  });

  test("a manager keeps a home node of their own like an employee", async ({ assert }) => {
    const ullern = await createBranch({ name: "Ullern" });
    const user = await createUser({ permission: "employee", employeeBranchId: ullern.id });

    await UserManagementService.setPermission(ADMIN, [user.id], "manager");

    const manager = await User.findOrFail(user.id);
    assert.equal(manager.permission, "manager");
    assert.equal(manager.employeeBranchId, ullern.id);
  });

  test("a manager may hand out every level below admin", async ({ assert }) => {
    const ullern = await createBranch({ name: "Ullern" });
    const user = await createUser();

    await UserManagementService.setPermission(MANAGER, [user.id], "manager", ullern.id);
    assert.equal((await User.findOrFail(user.id)).permission, "manager");

    await UserManagementService.setPermission(MANAGER, [user.id], "employee");
    assert.equal((await User.findOrFail(user.id)).permission, "employee");

    await UserManagementService.setPermission(MANAGER, [user.id], "customer");
    assert.equal((await User.findOrFail(user.id)).permission, "customer");
  });

  test("a manager may only home staff inside their own subtree", async ({ assert }) => {
    const ullern = await createBranch({ name: "Ullern" });
    const ullernVg1 = await createBranch({ parentBranchId: ullern.id });
    const nydalen = await createBranch({ name: "Nydalen" });
    const atUllern = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    // A pupil of the manager's own school: in scope, so only the node decides.
    const user = await createUser({ branchMembershipId: ullernVg1.id });

    assert.equal(
      await rejectionStatus(
        UserManagementService.setPermission(atUllern, [user.id], "employee", nydalen.id),
      ),
      400,
    );

    assert.equal((await User.findOrFail(user.id)).permission, "customer");

    await UserManagementService.setPermission(atUllern, [user.id], "employee", ullernVg1.id);
    assert.equal((await User.findOrFail(user.id)).employeeBranchId, ullernVg1.id);
  });

  test("a manager may only change people in their scope, and never make a root-scoped manager", async ({
    assert,
  }) => {
    const ullern = await createBranch({ name: "Ullern" });
    const nydalen = await createBranch({ name: "Nydalen" });
    const atUllern = userDouble({ permission: "manager", employeeBranchId: ullern.id });
    const staffElsewhere = await createUser({
      permission: "employee",
      employeeBranchId: nydalen.id,
    });
    const pupilElsewhere = await createUser({ branchMembershipId: nydalen.id });
    const privatist = await createUser();
    await createOrder({ branchId: ullern.id, customerId: privatist.id });

    // staff homed outside the subtree, and customers outside it, are unknown to the manager
    assert.equal(
      await rejectionStatus(
        UserManagementService.setPermission(atUllern, [staffElsewhere.id], "customer"),
      ),
      400,
    );
    assert.equal((await User.findOrFail(staffElsewhere.id)).permission, "employee");
    assert.equal(
      await rejectionStatus(
        UserManagementService.setPermission(atUllern, [pupilElsewhere.id], "employee", ullern.id),
      ),
      400,
    );
    // a customer in scope is homed at the root: promoting without a node would make head office
    assert.equal(
      await rejectionStatus(
        UserManagementService.setPermission(atUllern, [privatist.id], "manager"),
      ),
      400,
    );
    assert.equal((await User.findOrFail(privatist.id)).permission, "customer");
    await UserManagementService.setPermission(atUllern, [privatist.id], "employee", ullern.id);
    assert.equal((await User.findOrFail(privatist.id)).employeeBranchId, ullern.id);
  });

  test("a manager may not grant admin", async ({ assert }) => {
    const user = await createUser({ permission: "employee" });

    await assert.rejects(
      () => UserManagementService.setPermission(MANAGER, [user.id], "admin"),
      /Bare administratorer/,
    );
    assert.equal((await User.findOrFail(user.id)).permission, "employee");
  });

  test("a manager may not change an admin, even among other users", async ({ assert }) => {
    const admin = await createUser({ permission: "admin" });
    const employee = await createUser({ permission: "employee" });

    await assert.rejects(
      () => UserManagementService.setPermission(MANAGER, [employee.id, admin.id], "employee"),
      /administrator/,
    );
    assert.equal((await User.findOrFail(admin.id)).permission, "admin");
  });
});

test.group("UserManagementService.mergeUsers", (group) => {
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(seedTestCatalogue);
  group.each.setup(async () => {
    await createUser({ id: FROM });
    await createUser({ id: TO });
    await createUser({ id: OTHER });
  });

  test("repoints participants and handovers at the surviving user", async ({ assert }) => {
    const { match } = await seedMatch([FROM, OTHER]);
    await BookHandover.create({
      blid: "BL0001234567",
      itemId: ITEM_X,
      fromUserId: FROM,
      toUserId: OTHER,
      occurredAt: DateTime.now(),
    });

    await UserManagementService.mergeUsers(FROM, TO);

    const participants = await MatchParticipant.query().where("matchId", match.id);
    assert.sameMembers(
      participants.map((participant) => participant.userId),
      [TO, OTHER],
    );
    assert.equal((await BookHandover.firstOrFail()).fromUserId, TO);
  });

  test("moves signatures onto the surviving user", async ({ assert }) => {
    await Signature.create({
      customerId: FROM,
      signingName: "Test Testersen",
      signedByGuardian: false,
      image: Buffer.from("webp"),
    });

    await UserManagementService.mergeUsers(FROM, TO);

    assert.equal((await Signature.firstOrFail()).customerId, TO);
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
      remaining.map((participant) => participant.userId),
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
    assert.equal(remaining[0]?.userId, TO);
    assert.lengthOf(await MatchObligation.query().where("matchId", match.id), 0);
  });

  test("moves orders, books and invoices and deletes the source user", async ({ assert }) => {
    const [branch, item] = await Promise.all([createBranch(), createItem()]);
    const order = await createOrder({
      branchId: branch.id,
      customerId: FROM,
      orderItems: [{ itemId: item.id }],
    });
    const customerItem = await createCustomerItem({
      itemId: item.id,
      customerId: FROM,
      handoutBranchId: branch.id,
    });
    const invoice = await createInvoice({ customerId: FROM, customerName: "Gammelt navn" });

    await UserManagementService.mergeUsers(FROM, TO);

    assert.equal((await Order.getOrFail(order.id)).customerId, TO);
    assert.equal((await CustomerItem.findOrFail(customerItem.id)).customerId, TO);
    const merged = await Invoice.getOrFail(invoice.id);
    assert.equal(merged.customerId, TO);
    // The invoice keeps the customer as they were invoiced.
    assert.equal(merged.customerName, "Gammelt navn");
    assert.isNull(await User.find(FROM));
    assert.isNotNull(await User.find(TO));
  });

  test("a merge that fails part way changes nothing", async ({ assert }) => {
    const [branch, item] = await Promise.all([createBranch(), createItem()]);
    const order = await createOrder({
      branchId: branch.id,
      customerId: FROM,
      orderItems: [{ itemId: item.id }],
    });
    const sandbox = createSandbox();
    sandbox.stub(User.prototype, "delete").rejects(new Error("boom"));
    try {
      await assert.rejects(() => UserManagementService.mergeUsers(FROM, TO), "boom");
    } finally {
      sandbox.restore();
    }

    assert.equal((await Order.getOrFail(order.id)).customerId, FROM);
    assert.isNotNull(await User.find(FROM));
  });

  test("removes the source user's verification rows", async ({ assert }) => {
    await EmailVerification.create({ userId: FROM });
    await EmailVerification.create({ userId: TO });

    await UserManagementService.mergeUsers(FROM, TO);

    assert.lengthOf(await EmailVerification.query().where("userId", FROM), 0);
    assert.lengthOf(await EmailVerification.query().where("userId", TO), 1);
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
  let activeCustomerItemsStub: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(seedTestCatalogue);
  group.each.setup(async () => {
    await createUser({ id: FROM });
  });
  group.each.setup(() => {
    sandbox = createSandbox();
    activeCustomerItemsStub = sandbox.stub(CustomerItem, "hasActive").resolves(false);
  });
  group.each.teardown(() => sandbox.restore());

  test("deletes the user with their auth artifacts and signatures", async ({ assert }) => {
    await EmailVerification.create({ userId: FROM });
    await Signature.create({
      customerId: FROM,
      signingName: "Test Testersen",
      signedByGuardian: false,
      image: Buffer.from("webp"),
    });

    await UserManagementService.deleteUser(FROM);

    assert.isNull(await User.find(FROM));
    assert.lengthOf(await EmailVerification.query().where("userId", FROM), 0);
    assert.lengthOf(await Signature.query().where("customerId", FROM), 0);
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
      fromUserId: FROM,
      toUserId: OTHER,
      occurredAt: DateTime.now(),
      dischargesSenderObligationId: obligation.id,
      dischargesReceiverObligationId: obligation.id,
    });

    await UserManagementService.deleteUser(FROM);

    assert.isNotNull(await Match.find(match.id));
    const remaining = await MatchParticipant.query().where("matchId", match.id);
    assert.deepEqual(
      remaining.map((participant) => participant.userId),
      [OTHER],
    );
    const handover = await BookHandover.query().where("itemId", ITEM_X).firstOrFail();
    assert.isNull(handover.fromUserId);
    assert.isNull(handover.dischargesSenderObligationId);
  });

  test("deletes the customer's unpaid open orders and keeps the settled ones", async ({
    assert,
  }) => {
    const [branch, item] = await Promise.all([createBranch(), createItem()]);
    const open = await createOrder({
      branchId: branch.id,
      customerId: FROM,
      orderItems: [{ itemId: item.id }],
    });
    const handedOut = await createOrder({
      branchId: branch.id,
      customerId: FROM,
      orderItems: [{ itemId: item.id, handout: true }],
    });
    const unplaced = await createOrder({
      branchId: branch.id,
      customerId: FROM,
      placed: false,
      orderItems: [{ itemId: item.id }],
    });

    await UserManagementService.deleteUser(FROM);

    assert.isNull(await User.find(FROM));
    assert.isNull(await Order.find(open.id));
    assert.isNull((await Order.getOrFail(handedOut.id)).customerId);
    assert.isNull((await Order.getOrFail(unplaced.id)).customerId);
  });

  test("refuses while an open order of the customer has a payment", async ({ assert }) => {
    const [branch, item] = await Promise.all([createBranch(), createItem()]);
    const paid = await createOrder({
      branchId: branch.id,
      customerId: FROM,
      amount: 100,
      orderItems: [{ itemId: item.id, type: "partly-payment", amount: 100, unitPrice: 100 }],
    });
    await createPayment({ orderId: paid.id });
    const unpaid = await createOrder({
      branchId: branch.id,
      customerId: FROM,
      orderItems: [{ itemId: item.id }],
    });

    await assert.rejects(
      () => UserManagementService.deleteUser(FROM),
      "Kunden har betalte bestillinger som ikke er levert og kan ikke slettes. Refunder eller kanseller dem først.",
    );
    assert.isNotNull(await User.find(FROM));
    assert.equal((await Order.getOrFail(paid.id)).customerId, FROM);
    assert.equal((await Order.getOrFail(unpaid.id)).customerId, FROM);
  });

  test("refuses when the customer has active customer items", async ({ assert }) => {
    activeCustomerItemsStub.resolves(true);
    await assert.rejects(() => UserManagementService.deleteUser(FROM));
    assert.isNotNull(await User.find(FROM));
  });

  test("refuses when the customer has active invoices", async ({ assert }) => {
    await createInvoice({ customerId: FROM });
    await assert.rejects(
      () => UserManagementService.deleteUser(FROM),
      "Kunden har aktive fakturaer og kan ikke slettes",
    );
    assert.isNotNull(await User.find(FROM));
  });

  test("keeps settled invoices with the customer's details, unlinked from the deleted user", async ({
    assert,
  }) => {
    const invoice = await createInvoice({
      customerId: FROM,
      status: "paid",
      customerName: "Kari Nordmann",
      customerEmail: "kari@example.com",
      customerNumber: "93996",
    });

    await UserManagementService.deleteUser(FROM);

    const kept = await Invoice.getOrFail(invoice.id);
    assert.isNull(kept.customerId);
    assert.deepInclude(kept.toDto(null), {
      customerName: "Kari Nordmann",
      customerEmail: "kari@example.com",
      customerNumber: "93996",
      customerPhone: invoice.customerPhone,
      customerAddress: invoice.customerAddress,
      customerDob: invoice.customerDob?.toISODate() ?? null,
    });
  });

  test("refuses to delete employees or admins", async ({ assert }) => {
    await User.query().where("id", FROM).update({ permission: "employee" });
    await assert.rejects(() => UserManagementService.deleteUser(FROM));
    assert.isNotNull(await User.find(FROM));
  });
});
