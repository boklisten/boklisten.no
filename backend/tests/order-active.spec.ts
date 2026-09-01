import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { OrderActive } from "#services/legacy/collections/order/helpers/order-active/order-active";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Order } from "#shared/order/order";

test.group("OrderActive", (group) => {
  const orderActive = new OrderActive();
  const testUserId = "5d765db5fc8c47001c408d8d";
  let getOrderByQueryStub: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    getOrderByQueryStub = sandbox.stub(StorageService.Orders, "getByQuery");
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should resolve with false if no orders was found", async ({ assert }) => {
    getOrderByQueryStub.rejects(new BlError("not found").code(702));

    assert.isFalse(await orderActive.haveActiveOrders(testUserId));
  });

  test("should resolve with false if orders was found but none was active", async ({ assert }) => {
    const nonActiveOrder: Order = {
      id: "order1",
      amount: 100,
      orderItems: [],
      branch: "branch1",
      customer: testUserId,
      byCustomer: true,
      placed: false,
    };

    getOrderByQueryStub.resolves([nonActiveOrder]);

    assert.isFalse(await orderActive.haveActiveOrders(testUserId));
  });

  test("should resolve with true if orders was found and at least one was active", async ({
    assert,
  }) => {
    const nonActiveOrder: Order = {
      id: "order1",
      amount: 100,
      orderItems: [],
      branch: "branch1",
      customer: testUserId,
      byCustomer: true,
      placed: false,
    };

    const activeOrder: Order = {
      id: "order2",
      amount: 200,
      orderItems: [
        {
          type: "partly-payment",
          item: "item1",
          title: "title 1",
          amount: 100,
          unitPrice: 100,
          handout: false,
          delivered: false,
        },
      ],
      branch: "branch1",
      customer: testUserId,
      byCustomer: true,
      placed: true,
    };

    getOrderByQueryStub.resolves([nonActiveOrder, activeOrder]);

    assert.isTrue(await orderActive.haveActiveOrders(testUserId));
  });

  test("should resolve with false if orders was found and all order-items was handed out", async ({
    assert,
  }) => {
    const nonActiveOrder: Order = {
      id: "order1",
      amount: 100,
      orderItems: [
        {
          type: "partly-payment",
          item: "item1",
          title: "title 1",
          amount: 100,
          unitPrice: 100,
          handout: true,
          delivered: false,
        },
      ],
      branch: "branch1",
      customer: testUserId,
      byCustomer: true,
      placed: true,
    };

    const nonActiveOrder2: Order = {
      id: "order2",
      amount: 200,
      orderItems: [
        {
          type: "partly-payment",
          item: "item1",
          title: "title 1",
          amount: 100,
          unitPrice: 100,
          handout: true,
          delivered: false,
        },
      ],
      branch: "branch1",
      customer: testUserId,
      byCustomer: true,
      placed: true,
    };

    getOrderByQueryStub.resolves([nonActiveOrder, nonActiveOrder2]);

    assert.isFalse(await orderActive.haveActiveOrders(testUserId));
  });
});
