import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import type Item from "#models/item";
import Order from "#models/order";
import User from "#models/user";
import { OrderEmailHandler } from "#services/orders/order_email_handler";
import { OrderCancellationService } from "#services/order_cancellation_service";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

test.group("OrderCancellationService", (group) => {
  let sandbox: sinon.SinonSandbox;
  let sendOrderReceiptStub: sinon.SinonStub;
  let originalOrder: Order;
  let item: Item;
  let employee: User;

  group.each.setup(async () => {
    const truncate = await testUtils.db().truncate();
    sandbox = createSandbox();
    sendOrderReceiptStub = sandbox.stub(OrderEmailHandler, "sendOrderReceipt").resolves();

    const [branch, customer] = await Promise.all([createBranch(), createUser()]);
    [item, employee] = await Promise.all([
      createItem({ title: "Bok 1" }),
      createUser({ permission: "employee" }),
    ]);
    originalOrder = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [{ itemId: item.id }],
    });
    return truncate;
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  function cancel(options: { employeeId?: string; notifyCustomer: boolean }) {
    return OrderCancellationService.cancelOrderItems({
      originalOrder,
      orderItems: [{ itemId: item.id }],
      ...options,
    });
  }

  test("creates a customer cancellation order and sends the order email", async ({ assert }) => {
    const cancelOrder = await cancel({ notifyCustomer: true });

    const stored = await Order.getOrFail(cancelOrder.id);
    assert.isTrue(stored.byCustomer);
    assert.isNull(stored.employeeId);
    assert.equal(stored.amount, 0);
    assert.isTrue(stored.placed);
    assert.equal(stored.branchId, originalOrder.branchId);
    assert.equal(stored.customerId, originalOrder.customerId);
    assert.isTrue(stored.notifyByEmail);
    assert.deepEqual(
      stored.orderItems.map((orderItem) => ({
        movedFromOrderId: orderItem.movedFromOrderId,
        handout: orderItem.handout,
        delivered: orderItem.delivered,
        itemId: orderItem.itemId,
        title: orderItem.title,
        type: orderItem.type,
        amount: orderItem.amount,
        unitPrice: orderItem.unitPrice,
      })),
      [
        {
          movedFromOrderId: originalOrder.id,
          handout: false,
          delivered: true,
          itemId: item.id,
          title: "Bok 1",
          type: "cancel",
          amount: 0,
          unitPrice: 0,
        },
      ],
    );
    assert.equal(sendOrderReceiptStub.callCount, 1);
  });

  test("stamps movedToOrder on the original order items", async ({ assert }) => {
    const cancelOrder = await cancel({ notifyCustomer: true });

    const original = await Order.getOrFail(originalOrder.id);
    assert.deepEqual(
      original.orderItems.map((orderItem) => orderItem.movedToOrderId),
      [cancelOrder.id],
    );
  });

  test("marks admin cancellations with the employee and honours notifyCustomer off", async ({
    assert,
  }) => {
    const cancelOrder = await cancel({ employeeId: employee.id, notifyCustomer: false });

    const stored = await Order.getOrFail(cancelOrder.id);
    assert.isFalse(stored.byCustomer);
    assert.equal(stored.employeeId, employee.id);
    assert.isFalse(stored.notifyByEmail);
    assert.equal(sendOrderReceiptStub.callCount, 0);
  });

  test("still cancels when the customer no longer exists", async ({ assert }) => {
    sandbox.stub(User, "find").resolves(null);

    const cancelOrder = await cancel({ notifyCustomer: true });

    const original = await Order.getOrFail(originalOrder.id);
    assert.equal(original.orderItems[0]?.movedToOrderId, cancelOrder.id);
    assert.equal(sendOrderReceiptStub.callCount, 0);
  });

  test("cancels an order whose customer account was deleted", async ({ assert }) => {
    originalOrder.customerId = null;
    await originalOrder.save();

    const cancelOrder = await cancel({ notifyCustomer: true });

    assert.isNull((await Order.getOrFail(cancelOrder.id)).customerId);
    assert.equal(sendOrderReceiptStub.callCount, 0);
  });
});
