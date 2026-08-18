import { test } from "@japa/runner";
import { expect } from "chai";
import sinon, { createSandbox } from "sinon";

import { reconcileSignatureTask } from "#services/legacy/signature.helper";
import { StorageService } from "#services/storage_service";
import { CustomerItem } from "#shared/customer-item/customer-item";
import { Order } from "#shared/order/order";
import { UserDetail } from "#shared/user-detail";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const SIGNATURE_ID = "signature1";

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
    signatures: [],
    blid: "u#test",
    ...overrides,
  } as UserDetail;
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
  } as CustomerItem;
}

test.group("reconcileSignatureTask", (group) => {
  let sandbox: sinon.SinonSandbox;
  let orders: Order[];
  let customerItems: CustomerItem[];
  let updateStub: sinon.SinonStub;

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
    sandbox.stub(StorageService, "Signatures").value({
      get: sandbox.stub().callsFake((id: string) => {
        if (id !== SIGNATURE_ID) return Promise.reject(new Error("not found"));
        return Promise.resolve({
          id: SIGNATURE_ID,
          signingName: "Test Testersen",
          signedByGuardian: false,
          creationTime: new Date(),
        });
      }),
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

  test("clears the task when the user has a valid signature", async () => {
    const userDetail = makeUserDetail({
      signatures: [SIGNATURE_ID],
      tasks: { signAgreement: true },
    });

    const result = await reconcileSignatureTask(userDetail);

    expect(updateStub.calledOnceWith(CUSTOMER_ID, { "tasks.signAgreement": false })).to.equal(true);
    expect(result.tasks?.signAgreement).to.equal(false);
  });

  test("does not write when the user has a valid signature and no task set", async () => {
    const userDetail = makeUserDetail({ signatures: [SIGNATURE_ID] });

    const result = await reconcileSignatureTask(userDetail);

    expect(updateStub.called).to.equal(false);
    expect(result.tasks?.signAgreement ?? false).to.equal(false);
  });

  test("sets the task when an open rent order exists and no valid signature", async () => {
    orders = [makeRentOrder()];
    const userDetail = makeUserDetail();

    const result = await reconcileSignatureTask(userDetail);

    expect(updateStub.calledOnceWith(CUSTOMER_ID, { "tasks.signAgreement": true })).to.equal(true);
    expect(result.tasks?.signAgreement).to.equal(true);
  });

  test("does not set the task for orders with only partly-payment or buy items", async () => {
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

    expect(updateStub.called).to.equal(false);
  });

  test("does not set the task when the rent order items are all handed out", async () => {
    orders = [
      makeRentOrder({
        orderItems: [
          { type: "rent", item: "item1", title: "A", amount: 0, unitPrice: 0, handout: true },
        ] as Order["orderItems"],
      }),
    ];
    const userDetail = makeUserDetail();

    await reconcileSignatureTask(userDetail);

    expect(updateStub.called).to.equal(false);
  });

  test("sets the task when the customer possesses an active rent item", async () => {
    customerItems = [makeCustomerItem()];
    const userDetail = makeUserDetail();

    const result = await reconcileSignatureTask(userDetail);

    expect(updateStub.calledOnceWith(CUSTOMER_ID, { "tasks.signAgreement": true })).to.equal(true);
    expect(result.tasks?.signAgreement).to.equal(true);
  });

  test("treats customer items without a type as rent", async () => {
    customerItems = [makeCustomerItem({ type: undefined })];
    const userDetail = makeUserDetail();

    await reconcileSignatureTask(userDetail);

    expect(updateStub.calledOnceWith(CUSTOMER_ID, { "tasks.signAgreement": true })).to.equal(true);
  });

  test("ignores returned, bought out and not handed out customer items", async () => {
    customerItems = [
      makeCustomerItem({ returned: true }),
      makeCustomerItem({ id: "customerItem2", buyout: true }),
      makeCustomerItem({ id: "customerItem3", handout: false }),
      makeCustomerItem({ id: "customerItem4", type: "partly-payment" }),
    ];
    const userDetail = makeUserDetail();

    await reconcileSignatureTask(userDetail);

    expect(updateStub.called).to.equal(false);
  });

  test("keeps a requested task when there is no signature and no other trigger", async () => {
    const userDetail = makeUserDetail({ tasks: { signAgreement: true } });

    const result = await reconcileSignatureTask(userDetail);

    expect(updateStub.called).to.equal(false);
    expect(result.tasks?.signAgreement).to.equal(true);
  });

  test("leaves an unset task untouched when there are no triggers", async () => {
    const userDetail = makeUserDetail();

    const result = await reconcileSignatureTask(userDetail);

    expect(updateStub.called).to.equal(false);
    expect(result.tasks?.signAgreement ?? false).to.equal(false);
  });
});
