import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";
import sinon, { createSandbox } from "sinon";

import Signature from "#models/signature";
import { reconcileSignatureTask } from "#services/legacy/signature.helper";
import { StorageService } from "#services/storage_service";
import { CustomerItem } from "#shared/customer-item/customer-item";
import { Order } from "#shared/order/order";
import { UserDetail } from "#shared/user-detail";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";

function makeUserDetail(overrides: Partial<UserDetail> = {}): UserDetail {
  return {
    id: CUSTOMER_ID,
    name: "Test Testersen",
    email: "test@example.com",
    phone: "12345678",
    address: "Testveien 1",
    postCode: "0123",
    postCity: "OSLO",
    // An adult, so a non-guardian signature is the valid kind.
    dob: new Date(1990, 0, 1),
    blid: "u#test",
    ...overrides,
  };
}

function createValidSignature() {
  return Signature.create({
    customerDetailsId: CUSTOMER_ID,
    signingName: "Test Testersen",
    signedByGuardian: false,
    image: Buffer.from("webp"),
  });
}

function makeRentOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order1",
    placed: true,
    customer: CUSTOMER_ID,
    amount: 100,
    byCustomer: true,
    branch: "branch1",
    payments: [],
    orderItems: [
      {
        type: "rent",
        item: "item1",
        title: "Some Book",
        amount: 100,
        unitPrice: 100,
        taxRate: 0,
        taxAmount: 0,
      },
    ],
    ...overrides,
  } as Order;
}

function makeCustomerItem(overrides: Partial<CustomerItem> = {}): CustomerItem {
  return {
    id: "customerItem1",
    item: "item1",
    type: "rent",
    customer: CUSTOMER_ID,
    deadline: new Date(),
    handout: true,
    returned: false,
    ...overrides,
  };
}

test.group("reconcileSignatureTask", (group) => {
  let sandbox: sinon.SinonSandbox;
  let orders: Order[];
  let customerItems: CustomerItem[];
  let updateStub: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());

  group.each.setup(() => {
    sandbox = createSandbox();
    orders = [];
    customerItems = [];

    sandbox.stub(StorageService, "Orders").value({
      getByQuery: sandbox.stub().callsFake(() => Promise.resolve(orders)),
    });
    sandbox.stub(StorageService, "CustomerItems").value({
      getByQuery: sandbox.stub().callsFake(() => Promise.resolve(customerItems)),
    });
    updateStub = sandbox.stub().callsFake((id: string, data: Record<string, unknown>) =>
      Promise.resolve({
        ...makeUserDetail(),
        tasks: { signAgreement: data["tasks.signAgreement"] },
      }),
    );
    sandbox.stub(StorageService, "UserDetails").value({ update: updateStub });
  });

  group.each.teardown(() => {
    sandbox.restore();
  });

  test("clears the task when the user has a valid signature", async ({ assert }) => {
    await createValidSignature();
    const userDetail = makeUserDetail({ tasks: { signAgreement: true } });

    const result = await reconcileSignatureTask(userDetail);

    assert.equal(updateStub.calledOnceWith(CUSTOMER_ID, { "tasks.signAgreement": false }), true);
    assert.equal(result.tasks?.signAgreement, false);
  });

  test("does not write when the user has a valid signature and no task set", async ({ assert }) => {
    await createValidSignature();
    const userDetail = makeUserDetail();

    const result = await reconcileSignatureTask(userDetail);

    assert.equal(updateStub.called, false);
    assert.equal(result.tasks?.signAgreement ?? false, false);
  });

  test("judges only the newest signature, even when an older one is valid", async ({ assert }) => {
    await createValidSignature();
    // A newer guardian-signed signature is invalid for an adult.
    await Signature.create({
      customerDetailsId: CUSTOMER_ID,
      signingName: "Guardian Guardiansen",
      signedByGuardian: true,
      image: Buffer.from("webp"),
      createdAt: DateTime.now().plus({ hours: 1 }),
    });
    orders = [makeRentOrder()];
    const userDetail = makeUserDetail();

    const result = await reconcileSignatureTask(userDetail);

    assert.equal(updateStub.calledOnceWith(CUSTOMER_ID, { "tasks.signAgreement": true }), true);
    assert.equal(result.tasks?.signAgreement, true);
  });

  test("sets the task when an open rent order exists and no valid signature", async ({
    assert,
  }) => {
    orders = [makeRentOrder()];
    const userDetail = makeUserDetail();

    const result = await reconcileSignatureTask(userDetail);

    assert.equal(updateStub.calledOnceWith(CUSTOMER_ID, { "tasks.signAgreement": true }), true);
    assert.equal(result.tasks?.signAgreement, true);
  });

  test("does not set the task for orders with only partly-payment or buy items", async ({
    assert,
  }) => {
    orders = [
      makeRentOrder({
        orderItems: [
          { type: "partly-payment", item: "item1", title: "A", amount: 100, unitPrice: 100 },
          { type: "buy", item: "item2", title: "B", amount: 100, unitPrice: 100 },
        ] as Order["orderItems"],
      }),
    ];
    const userDetail = makeUserDetail();

    await reconcileSignatureTask(userDetail);

    assert.equal(updateStub.called, false);
  });

  test("does not set the task when the rent order items are all handed out", async ({ assert }) => {
    orders = [
      makeRentOrder({
        orderItems: [
          { type: "rent", item: "item1", title: "A", amount: 0, unitPrice: 0, handout: true },
        ] as Order["orderItems"],
      }),
    ];
    const userDetail = makeUserDetail();

    await reconcileSignatureTask(userDetail);

    assert.equal(updateStub.called, false);
  });

  test("sets the task when the customer possesses an active rent item", async ({ assert }) => {
    customerItems = [makeCustomerItem()];
    const userDetail = makeUserDetail();

    const result = await reconcileSignatureTask(userDetail);

    assert.equal(updateStub.calledOnceWith(CUSTOMER_ID, { "tasks.signAgreement": true }), true);
    assert.equal(result.tasks?.signAgreement, true);
  });

  test("treats customer items without a type as rent", async ({ assert }) => {
    customerItems = [makeCustomerItem({ type: undefined })];
    const userDetail = makeUserDetail();

    await reconcileSignatureTask(userDetail);

    assert.equal(updateStub.calledOnceWith(CUSTOMER_ID, { "tasks.signAgreement": true }), true);
  });

  test("ignores returned, bought out and not handed out customer items", async ({ assert }) => {
    customerItems = [
      makeCustomerItem({ returned: true }),
      makeCustomerItem({ id: "customerItem2", buyout: true }),
      makeCustomerItem({ id: "customerItem3", handout: false }),
      makeCustomerItem({ id: "customerItem4", type: "partly-payment" }),
    ];
    const userDetail = makeUserDetail();

    await reconcileSignatureTask(userDetail);

    assert.equal(updateStub.called, false);
  });

  test("keeps a requested task when there is no signature and no other trigger", async ({
    assert,
  }) => {
    const userDetail = makeUserDetail({ tasks: { signAgreement: true } });

    const result = await reconcileSignatureTask(userDetail);

    assert.equal(updateStub.called, false);
    assert.equal(result.tasks?.signAgreement, true);
  });

  test("leaves an unset task untouched when there are no triggers", async ({ assert }) => {
    const userDetail = makeUserDetail();

    const result = await reconcileSignatureTask(userDetail);

    assert.equal(updateStub.called, false);
    assert.equal(result.tasks?.signAgreement ?? false, false);
  });
});
