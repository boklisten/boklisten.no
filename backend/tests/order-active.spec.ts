import { test } from "@japa/runner";
import { expect, use as chaiUse, should } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { createSandbox } from "sinon";

import { OrderActive } from "#services/legacy/collections/order/helpers/order-active/order-active";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { Order } from "#shared/order/order";

chaiUse(chaiAsPromised);
should();

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

  test("should resolve with false if no orders was found", async () => {
    getOrderByQueryStub.rejects(new BlError("not found").code(702));

    return expect(orderActive.haveActiveOrders(testUserId)).to.eventually.be.false;
  });

  test("should resolve with false if orders was found but none was active", async () => {
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

    return expect(orderActive.haveActiveOrders(testUserId)).to.eventually.be.false;
  });

  test("should resolve with true if orders was found and at least one was active", async () => {
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

    return expect(orderActive.haveActiveOrders(testUserId)).to.eventually.be.true;
  });

  test("should resolve with false if orders was found and all order-items was handed out", async () => {
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

    return expect(orderActive.haveActiveOrders(testUserId)).to.eventually.be.false;
  });
});
