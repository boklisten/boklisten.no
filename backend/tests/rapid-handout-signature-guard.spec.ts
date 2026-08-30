import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";
import sinon, { createSandbox } from "sinon";

import Signature from "#models/signature";
import { verifyCustomerSignature } from "#services/legacy/signature.helper";
import { StorageService } from "#services/storage_service";
import { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";
import { OrderItemType } from "#shared/order/order-item/order-item-type";
import { mock } from "#tests/test-doubles";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const adultDob = new Date(new Date().getFullYear() - 30, 0, 1);
const childDob = new Date(new Date().getFullYear() - 10, 0, 1);

function userDetailWith(overrides: Partial<UserDetail>): UserDetail {
  return mock<UserDetail>({
    id: CUSTOMER_ID,
    name: "Test Kunde",
    dob: adultDob,
    ...overrides,
  });
}

function createSignature(overrides: Partial<Parameters<typeof Signature.create>[0]> = {}) {
  return Signature.create({
    customerDetailsId: CUSTOMER_ID,
    signingName: "Test Kunde",
    signedByGuardian: false,
    image: Buffer.from("webp"),
    ...overrides,
  });
}

function openOrderWith(type: OrderItemType): Order {
  return mock<Order>({
    id: "order1",
    placed: true,
    customer: CUSTOMER_ID,
    orderItems: [{ type, item: "item1", title: "Bok", amount: 100, unitPrice: 100 }],
  });
}

test.group("verifyCustomerSignature", (group) => {
  let sandbox: sinon.SinonSandbox;
  let userDetailStub: sinon.SinonStub;
  let orders: Order[];

  group.each.setup(() => testUtils.db().truncate());

  group.each.setup(() => {
    sandbox = createSandbox();
    userDetailStub = sandbox.stub(StorageService.UserDetails, "getOrNull");
    sandbox.stub(StorageService.UserDetails, "update").callsFake((id, data) =>
      Promise.resolve(
        mock<UserDetail>({
          ...userDetailWith({}),
          tasks: {
            signAgreement: (data as Record<string, unknown>)["tasks.signAgreement"] === true,
          },
        }),
      ),
    );
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
    userDetailStub.resolves(userDetailWith({}));

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.typeOf(feedback, "string");
    assert.include(feedback, "signatur");
  });

  test("should return feedback when the signature task is requested", async ({ assert }) => {
    userDetailStub.resolves(userDetailWith({ tasks: { signAgreement: true } }));

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.typeOf(feedback, "string");
    assert.include(feedback, "signatur");
  });

  test("should return feedback when an unsigned customer has an open partly-payment order", async ({
    assert,
  }) => {
    orders = [openOrderWith("partly-payment")];
    userDetailStub.resolves(userDetailWith({}));

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.typeOf(feedback, "string");
    assert.include(feedback, "signatur");
  });

  test("should return null for an unsigned customer with only a buy order", async ({ assert }) => {
    orders = [openOrderWith("buy")];
    userDetailStub.resolves(userDetailWith({}));

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.equal(feedback, null);
  });

  test("should return feedback when the newest signature is expired and a rent order is open", async ({
    assert,
  }) => {
    orders = [openOrderWith("rent")];
    userDetailStub.resolves(userDetailWith({}));
    await createSignature({ createdAt: DateTime.local(2000, 1, 1) });

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.typeOf(feedback, "string");
    assert.include(feedback, "signatur");
  });

  test("should return feedback when an underage customer signed without a guardian", async ({
    assert,
  }) => {
    orders = [openOrderWith("rent")];
    userDetailStub.resolves(userDetailWith({ dob: childDob }));
    await createSignature();

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.typeOf(feedback, "string");
    assert.include(feedback, "signatur");
  });

  test("should return null when the customer has a valid signature", async ({ assert }) => {
    orders = [openOrderWith("rent")];
    userDetailStub.resolves(userDetailWith({}));
    await createSignature();

    const feedback = await verifyCustomerSignature(CUSTOMER_ID);

    assert.equal(feedback, null);
  });
});
