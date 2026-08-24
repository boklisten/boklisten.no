import { test } from "@japa/runner";
import sinon, { createSandbox } from "sinon";

import { verifyCustomerSignature } from "#services/legacy/signature.helper";
import { StorageService } from "#services/storage_service";
import { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const adultDob = new Date(new Date().getFullYear() - 30, 0, 1);
const childDob = new Date(new Date().getFullYear() - 10, 0, 1);

function userDetailWith(overrides: Partial<UserDetail>): UserDetail {
  return {
    id: CUSTOMER_ID,
    name: "Test Kunde",
    dob: adultDob,
    signatures: [],
    ...overrides,
  } as UserDetail;
}

function openOrderWith(type: string): Order {
  return {
    id: "order1",
    placed: true,
    customer: CUSTOMER_ID,
    orderItems: [{ type, item: "item1", title: "Bok", amount: 100, unitPrice: 100 }],
  } as Order;
}

test.group("verifyCustomerSignature", (group) => {
  let sandbox: sinon.SinonSandbox;
  let userDetailStub: sinon.SinonStub;
  let signatureStub: sinon.SinonStub;
  let orders: Order[];

  group.each.setup(() => {
    sandbox = createSandbox();
    userDetailStub = sandbox.stub(StorageService.UserDetails, "getOrNull");
    sandbox.stub(StorageService.UserDetails, "update").callsFake((id, data) =>
      Promise.resolve({
        ...userDetailWith({}),
        tasks: { signAgreement: (data as Record<string, unknown>)["tasks.signAgreement"] },
      } as UserDetail),
    );
    signatureStub = sandbox.stub(StorageService.Signatures, "get");
    orders = [];
    sandbox.stub(StorageService.Orders, "getByQuery").callsFake(() => Promise.resolve(orders));
    sandbox.stub(StorageService.CustomerItems, "getByQuery").callsFake(() => Promise.resolve([]));
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should return feedback when the customer does not exist", async ({ assert }) => {
    userDetailStub.resolves(null);

    const feedback = await verifyCustomerSignature("missing-customer");

    assert.typeOf(feedback, "string");
    assert.include(feedback, "signatur");
  });

  test("should return feedback when an unsigned customer has an open rent order", async ({
    assert,
  }) => {
    orders = [openOrderWith("rent")];
    userDetailStub.resolves(userDetailWith({ signatures: [] }));

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.typeOf(feedback, "string");
    assert.include(feedback, "signatur");
  });

  test("should return feedback when the signature task is requested", async ({ assert }) => {
    userDetailStub.resolves(userDetailWith({ signatures: [], tasks: { signAgreement: true } }));

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.typeOf(feedback, "string");
    assert.include(feedback, "signatur");
  });

  test("should return null for an unsigned customer with only a partly-payment order", async ({
    assert,
  }) => {
    orders = [openOrderWith("partly-payment")];
    userDetailStub.resolves(userDetailWith({ signatures: [] }));

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.equal(feedback, null);
  });

  test("should return feedback when the newest signature is expired and a rent order is open", async ({
    assert,
  }) => {
    orders = [openOrderWith("rent")];
    userDetailStub.resolves(userDetailWith({ signatures: ["signature1"] }));
    signatureStub.resolves({
      signedByGuardian: false,
      creationTime: new Date(2000, 0, 1),
    });

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.typeOf(feedback, "string");
    assert.include(feedback, "signatur");
  });

  test("should return feedback when an underage customer signed without a guardian", async ({
    assert,
  }) => {
    orders = [openOrderWith("rent")];
    userDetailStub.resolves(userDetailWith({ dob: childDob, signatures: ["signature1"] }));
    signatureStub.resolves({
      signedByGuardian: false,
      creationTime: new Date(),
    });

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.typeOf(feedback, "string");
    assert.include(feedback, "signatur");
  });

  test("should return null when the customer has a valid signature", async ({ assert }) => {
    orders = [openOrderWith("rent")];
    userDetailStub.resolves(userDetailWith({ signatures: ["signature1"] }));
    signatureStub.resolves({
      signedByGuardian: false,
      creationTime: new Date(),
    });

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.equal(feedback, null);
  });
});
