import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { stub } from "sinon";
import { DateTime } from "luxon";

import type Order from "#models/order";
import User from "#models/user";
import { CustomerItemHandler } from "#services/customer_items/customer_item_handler";
import { OrderItemMovedFromOrderHandler } from "#services/orders/order_item_moved_from_order_handler";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { PaymentHandler } from "#services/orders/payment_handler";
import { OrderEmailHandler } from "#services/orders/order_email_handler";
import { BlError } from "#shared/bl-error";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

test.group("OrderPlacedHandler", (group) => {
  let testOrder: Order;
  let paymentsConfirmed: boolean;
  let testUser: User;

  const paymentHandler = new PaymentHandler();
  const orderItemMovedFromOrderHandler = new OrderItemMovedFromOrderHandler();
  const customerItemHandler = new CustomerItemHandler();
  const orderPlacedHandler = new OrderPlacedHandler(
    paymentHandler,
    customerItemHandler,
    orderItemMovedFromOrderHandler,
  );

  group.each.setup(async () => {
    const rollback = await testUtils.db().wrapInGlobalTransaction();

    stub(orderItemMovedFromOrderHandler, "updateOrderItems").resolves();

    stub(User, "find").callsFake((id: string) =>
      Promise.resolve(id === testUser.id ? testUser : null),
    );
    stub(User, "findOrFail").callsFake((id: string) => {
      if (id !== testUser.id) {
        return Promise.reject(new Error("user not found"));
      }
      return Promise.resolve(testUser);
    });

    stub(paymentHandler, "confirmPayments").callsFake(() => {
      if (!paymentsConfirmed) {
        return Promise.reject(new BlError("could not confirm payments"));
      }

      return Promise.resolve();
    });

    stub(OrderEmailHandler, "sendOrderReceipt").resolves();

    paymentsConfirmed = true;

    const [branch, customer, item] = await Promise.all([
      createBranch(),
      createUser(),
      createItem({ title: "Signatur 3: Tekstsammling" }),
    ]);
    testUser = customer;
    testOrder = await createOrder({
      amount: 100,
      orderItems: [
        {
          type: "rent",
          itemId: item.id,
          amount: 50,
          unitPrice: 100,
          periodFrom: DateTime.now(),
          periodTo: DateTime.now(),
          numberOfPeriods: 1,
          periodType: "semester",
        },
      ],
      branchId: branch.id,
      customerId: customer.id,
      byCustomer: true,
      placed: false,
      notifyByEmail: false,
    });

    return rollback;
  });

  test("should reject if order could not be updated with confirm true", async ({ assert }) => {
    stub(testOrder, "save").rejects(new BlError("could not update order"));

    const err = await orderPlacedHandler.placeOrder(testOrder, "user1").then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(err, BlError);
    assert.equal(err?.errorStack[0]?.getMsg(), "could not update order");
  });

  test("should reject if paymentHandler.confirmPayments rejects", async ({ assert }) => {
    paymentsConfirmed = false;

    const err = await orderPlacedHandler.placeOrder(testOrder, "user1").then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(err, BlError);
    assert.equal(err?.errorStack[0]?.getMsg(), "could not confirm payments");
  });

  test("should resolve when order was placed", async ({ assert }) => {
    await orderPlacedHandler.placeOrder(testOrder, "user1");

    await testOrder.refresh();
    assert.isTrue(testOrder.placed);
  });
});
