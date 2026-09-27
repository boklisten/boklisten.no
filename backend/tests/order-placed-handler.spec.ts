import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";
import { DateTime } from "luxon";

import type Order from "#models/order";
import User from "#models/user";
import { CustomerItemHandler } from "#services/customer_items/customer_item_handler";
import { OrderItemMovedFromOrderHandler } from "#services/orders/order_item_moved_from_order_handler";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { PaymentHandler } from "#services/orders/payment_handler";
import { OrderEmailHandler } from "#services/orders/order_email_handler";
import { BlError } from "#shared/bl-error";
import type { Payment } from "#shared/payment/payment";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser, userDouble } from "#tests/user_fixtures";

test.group("OrderPlacedHandler", (group) => {
  let testOrder: Order;
  let testPayment: Payment;
  let paymentsConfirmed: boolean;
  let testUserDetail: User;

  const paymentHandler = new PaymentHandler();
  const orderItemMovedFromOrderHandler = new OrderItemMovedFromOrderHandler();
  const customerItemHandler = new CustomerItemHandler();
  const orderPlacedHandler = new OrderPlacedHandler(
    paymentHandler,
    customerItemHandler,
    orderItemMovedFromOrderHandler,
  );

  let sandbox: sinon.SinonSandbox;
  group.each.setup(async () => {
    const truncate = await testUtils.db().truncate();
    sandbox = createSandbox();

    sandbox.stub(orderItemMovedFromOrderHandler, "updateOrderItems").resolves(true);

    sandbox
      .stub(User, "find")
      .callsFake((id: string) => Promise.resolve(id === testUserDetail.id ? testUserDetail : null));
    sandbox.stub(User, "findOrFail").callsFake((id: string) => {
      if (id !== testUserDetail.id) {
        return Promise.reject(new Error("user not found"));
      }
      return Promise.resolve(testUserDetail);
    });

    sandbox.stub(paymentHandler, "confirmPayments").callsFake(() => {
      if (!paymentsConfirmed) {
        return Promise.reject(new BlError("could not confirm payments"));
      }

      return Promise.resolve([testPayment]);
    });

    sandbox.stub(OrderEmailHandler, "sendOrderReceipt").resolves();

    paymentsConfirmed = true;

    const [branch, customer, item] = await Promise.all([
      createBranch(),
      createUser(),
      createItem({ title: "Signatur 3: Tekstsammling" }),
    ]);
    testUserDetail = customer;
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

    testPayment = {
      id: "payment1",
      method: "vipps-checkout",
      order: "order1",
      amount: 200,
      customer: "customer1",
      branch: "branch1",
      confirmed: false,
      info: {
        paymentId: "vipps-checkout1",
      },
    };

    return truncate;
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if order could not be updated with confirm true", async ({ assert }) => {
    sandbox.stub(testOrder, "save").rejects(new BlError("could not update order"));

    const err = await orderPlacedHandler.placeOrder(testOrder, "userDetail1").then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(err, BlError);
    assert.equal(err?.errorStack[0]?.getMsg(), "could not update order");
  });

  test("should reject if paymentHandler.confirmPayments rejects", async ({ assert }) => {
    paymentsConfirmed = false;

    const err = await orderPlacedHandler.placeOrder(testOrder, "userDetail1").then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(err, BlError);
    assert.equal(err?.errorStack[0]?.getMsg(), "could not confirm payments");
  });

  test("should reject if order.customer is not found", async ({ assert }) => {
    testUserDetail = userDouble({ id: "notTheCustomer" });

    const err = await orderPlacedHandler.placeOrder(testOrder, "userDetail1").then(
      () => null,
      (error: BlError) => error,
    );
    assert.instanceOf(err, BlError);
    assert.equal(err?.errorStack[0]?.getMsg(), `customer "${testOrder.customerId}" not found`);
  });

  test("should resolve when order was placed", async ({ assert }) => {
    await orderPlacedHandler.placeOrder(testOrder, "userDetail1");

    await testOrder.refresh();
    assert.isTrue(testOrder.placed);
  });
});
