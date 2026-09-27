import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import Payment from "#models/payment";
import { PaymentHandler } from "#services/orders/payment_handler";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createPayment } from "#tests/payment_fixtures";
import { createUser } from "#tests/user_fixtures";

async function refundOrder(byCustomer: boolean) {
  const [branch, item, customer] = await Promise.all([createBranch(), createItem(), createUser()]);
  return createOrder({
    branchId: branch.id,
    customerId: customer.id,
    amount: -250,
    byCustomer,
    orderItems: [{ itemId: item.id, type: "cancel", amount: -250 }],
  });
}

test.group("PaymentHandler.confirmPayments", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("confirms a refund the administrator makes by bank transfer", async ({ assert }) => {
    const order = await refundOrder(false);
    const payment = await createPayment({
      orderId: order.id,
      method: "bank-transfer",
      amount: -250,
      confirmed: false,
    });

    await new PaymentHandler().confirmPayments(order);

    assert.isTrue((await Payment.findOrFail(payment.id)).confirmed);
  });

  test("confirms nothing when a method is not permitted for the customer", async ({ assert }) => {
    const order = await refundOrder(true);
    await createPayment({
      orderId: order.id,
      method: "vipps-epayment",
      amount: -100,
      confirmed: false,
    });
    const cash = await createPayment({
      orderId: order.id,
      method: "cash",
      amount: -150,
      confirmed: false,
    });

    await assert.rejects(
      () => new PaymentHandler().confirmPayments(order),
      /payment method "cash" is not permitted for customer/,
    );
    assert.isFalse((await Payment.findOrFail(cash.id)).confirmed);
    assert.deepEqual(
      (await Payment.ofOrder(order.id)).map((payment) => payment.confirmed),
      [false, false],
    );
  });

  test("refuses payments that do not add up to the order", async ({ assert }) => {
    const order = await refundOrder(false);
    await createPayment({ orderId: order.id, method: "cash", amount: -200, confirmed: false });

    await assert.rejects(
      () => new PaymentHandler().confirmPayments(order),
      /total of payment amounts does not equal/,
    );
  });
});
