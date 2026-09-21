import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { OrderEmailHandler } from "#services/orders/order_email_handler";
import { OrderCancellationService } from "#services/order_cancellation_service";
import User from "#models/user";
import { StorageService } from "#services/storage_service";
import { userDouble } from "#tests/user_fixtures";

test.group("OrderCancellationService", (group) => {
  let sandbox: sinon.SinonSandbox;
  let addOrderStub: sinon.SinonStub;
  let getOrderStub: sinon.SinonStub;
  let updateOrderStub: sinon.SinonStub;
  let findUserStub: sinon.SinonStub;
  let sendOrderReceiptStub: sinon.SinonStub;

  const originalOrder = { id: "order1", branch: "branch1", customer: "customer1" };
  const orderItems = [{ item: "item1", title: "Bok 1" }];

  group.each.setup(() => {
    sandbox = createSandbox();
    const ordersStub = { add: sandbox.stub(), get: sandbox.stub(), update: sandbox.stub() };
    sandbox.stub(StorageService, "Orders").value(ordersStub);
    findUserStub = sandbox.stub(User, "find");
    sendOrderReceiptStub = sandbox.stub(OrderEmailHandler, "sendOrderReceipt").resolves();

    addOrderStub = ordersStub.add;
    getOrderStub = ordersStub.get;
    updateOrderStub = ordersStub.update;

    addOrderStub.callsFake(async (order) => ({ ...order, id: "cancelOrder1" }));
    getOrderStub
      .withArgs("order1")
      .resolves({ id: "order1", orderItems: [{ item: "item1", title: "Bok 1" }] });
    updateOrderStub.resolves({});
    findUserStub.withArgs("customer1").resolves(userDouble({ id: "customer1" }));
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("creates a customer cancellation order and sends the order email", async ({ assert }) => {
    const cancelOrder = await OrderCancellationService.cancelOrderItems({
      originalOrder,
      orderItems,
      notifyCustomer: true,
    });

    assert.equal(cancelOrder.id, "cancelOrder1");
    assert.equal(addOrderStub.callCount, 1);
    const added = addOrderStub.firstCall.args[0];
    assert.equal(added.byCustomer, true);
    assert.equal(added.employee, undefined);
    assert.equal(added.amount, 0);
    assert.equal(added.placed, true);
    assert.equal(added.branch, "branch1");
    assert.equal(added.customer, "customer1");
    assert.deepEqual(added.notification, { email: true });
    assert.deepEqual(added.orderItems, [
      {
        movedFromOrder: "order1",
        handout: false,
        delivered: true,
        item: "item1",
        title: "Bok 1",
        type: "cancel",
        amount: 0,
        unitPrice: 0,
      },
    ]);
    assert.equal(sendOrderReceiptStub.callCount, 1);
  });

  test("stamps movedToOrder on the original order items", async ({ assert }) => {
    await OrderCancellationService.cancelOrderItems({
      originalOrder,
      orderItems,
      notifyCustomer: true,
    });

    assert.deepEqual(updateOrderStub.args, [
      ["order1", { orderItems: [{ item: "item1", title: "Bok 1", movedToOrder: "cancelOrder1" }] }],
    ]);
  });

  test("marks admin cancellations with the employee and honours notifyCustomer off", async ({
    assert,
  }) => {
    await OrderCancellationService.cancelOrderItems({
      originalOrder,
      orderItems,
      employeeDetailsId: "employee1",
      notifyCustomer: false,
    });

    const added = addOrderStub.firstCall.args[0];
    assert.equal(added.byCustomer, false);
    assert.equal(added.employee, "employee1");
    assert.deepEqual(added.notification, { email: false });
    assert.equal(sendOrderReceiptStub.callCount, 0);
  });

  test("still cancels when the customer no longer exists", async ({ assert }) => {
    findUserStub.withArgs("customer1").resolves(null);

    const cancelOrder = await OrderCancellationService.cancelOrderItems({
      originalOrder,
      orderItems,
      notifyCustomer: true,
    });

    assert.equal(cancelOrder.id, "cancelOrder1");
    assert.equal(updateOrderStub.callCount, 1);
    assert.equal(sendOrderReceiptStub.callCount, 0);
  });
});
