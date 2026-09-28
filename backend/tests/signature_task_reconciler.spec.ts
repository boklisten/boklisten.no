import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Signature from "#models/signature";
import User from "#models/user";
import { reconcileSignatureTask } from "#services/signature_helper";
import type { OrderItemType } from "#shared/order/order-item/order-item-type";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
let saveSpy: sinon.SinonSpy;

/** An adult, so a non-guardian signature is the valid kind. Inserting the row is not a "write". */
async function makeUser(overrides: { taskSignAgreement?: boolean } = {}): Promise<User> {
  const user = await createUser({
    id: CUSTOMER_ID,
    dob: DateTime.fromISO("1990-01-01"),
    taskSignAgreement: false,
    ...overrides,
  });
  saveSpy.resetHistory();
  return user;
}

async function storedTask(): Promise<boolean> {
  return (await User.findOrFail(CUSTOMER_ID)).taskSignAgreement;
}

function createValidSignature() {
  return Signature.create({
    customerId: CUSTOMER_ID,
    signingName: "Test Testersen",
    signedByGuardian: false,
    image: Buffer.from("webp"),
  });
}

function createOpenOrder(line: { type?: OrderItemType; handout?: boolean } = {}) {
  return createOrder({
    branchId: "branch1",
    customerId: CUSTOMER_ID,
    byCustomer: true,
    orderItems: [{ itemId: "item1", ...line }],
  });
}

/** A book the customer holds; the customer must have been created first. */
function makeCustomerItem(overrides: Partial<Parameters<typeof createCustomerItem>[0]> = {}) {
  return createCustomerItem({
    itemId: "item1",
    customerId: CUSTOMER_ID,
    handoutBranchId: "branch1",
    ...overrides,
  });
}

test.group("reconcileSignatureTask", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createBranch({ id: "branch1" });
    await createItem({ id: "item1", title: "Some Book" });
  });

  group.each.setup(() => {
    sandbox = createSandbox();
    saveSpy = sandbox.spy(User.prototype, "save");
  });

  group.each.teardown(() => {
    sandbox.restore();
  });

  test("clears the task when the user has a valid signature", async ({ assert }) => {
    const user = await makeUser({ taskSignAgreement: true });
    await createValidSignature();

    const result = await reconcileSignatureTask(user);

    assert.equal(result.taskSignAgreement, false);
    assert.equal(await storedTask(), false);
  });

  test("does not write when the user has a valid signature and no task set", async ({ assert }) => {
    const user = await makeUser();
    await createValidSignature();

    const result = await reconcileSignatureTask(user);

    assert.equal(saveSpy.called, false);
    assert.equal(result.taskSignAgreement, false);
  });

  test("judges only the newest signature, even when an older one is valid", async ({ assert }) => {
    const user = await makeUser();
    await createValidSignature();
    // A newer guardian-signed signature is invalid for an adult.
    await Signature.create({
      customerId: CUSTOMER_ID,
      signingName: "Guardian Guardiansen",
      signedByGuardian: true,
      image: Buffer.from("webp"),
      createdAt: DateTime.now().plus({ hours: 1 }),
    });
    await createOpenOrder();

    const result = await reconcileSignatureTask(user);

    assert.equal(result.taskSignAgreement, true);
    assert.equal(await storedTask(), true);
  });

  test("sets the task when an open rent order exists and no valid signature", async ({
    assert,
  }) => {
    const user = await makeUser();
    await createOpenOrder();

    const result = await reconcileSignatureTask(user);

    assert.equal(result.taskSignAgreement, true);
    assert.equal(await storedTask(), true);
  });

  test("sets the task when an open partly-payment order exists", async ({ assert }) => {
    const user = await makeUser();
    await createOpenOrder({ type: "partly-payment" });

    const result = await reconcileSignatureTask(user);

    assert.equal(result.taskSignAgreement, true);
    assert.equal(await storedTask(), true);
  });

  test("does not set the task for orders with only buy items", async ({ assert }) => {
    const user = await makeUser();
    await createOpenOrder({ type: "buy" });

    await reconcileSignatureTask(user);

    assert.equal(saveSpy.called, false);
  });

  test("does not set the task when the rent order items are all handed out", async ({ assert }) => {
    const user = await makeUser();
    await createOpenOrder({ type: "rent", handout: true });

    await reconcileSignatureTask(user);

    assert.equal(saveSpy.called, false);
  });

  test("sets the task when the customer possesses an active rent item", async ({ assert }) => {
    const user = await makeUser();
    await makeCustomerItem();

    const result = await reconcileSignatureTask(user);

    assert.equal(result.taskSignAgreement, true);
    assert.equal(await storedTask(), true);
  });

  test("sets the task for active customer items regardless of type", async ({ assert }) => {
    const user = await makeUser();
    await makeCustomerItem({ type: "partly-payment" });

    await reconcileSignatureTask(user);

    assert.equal(await storedTask(), true);
  });

  test("ignores returned, bought out and cancelled customer items", async ({ assert }) => {
    const user = await makeUser();
    await makeCustomerItem({ returned: true });
    await makeCustomerItem({ buyout: true });
    await makeCustomerItem({ returned: true, cancel: true });

    await reconcileSignatureTask(user);

    assert.equal(saveSpy.called, false);
  });

  test("keeps a requested task when there is no signature and no other trigger", async ({
    assert,
  }) => {
    const user = await makeUser({ taskSignAgreement: true });

    const result = await reconcileSignatureTask(user);

    assert.equal(saveSpy.called, false);
    assert.equal(result.taskSignAgreement, true);
  });

  test("leaves an unset task untouched when there are no triggers", async ({ assert }) => {
    const user = await makeUser();

    const result = await reconcileSignatureTask(user);

    assert.equal(saveSpy.called, false);
    assert.equal(result.taskSignAgreement, false);
  });
});
