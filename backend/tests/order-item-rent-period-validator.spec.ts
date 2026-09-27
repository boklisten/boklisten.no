import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import type OrderItem from "#models/order_item";
import Payment from "#models/payment";
import { OrderItemRentPeriodValidator } from "#services/orders/validation/order_item_rent_period_validator";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import type { Period } from "#shared/period";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { mock } from "#tests/test-doubles";
import { createUser } from "#tests/user_fixtures";

function movedOrderItem(amount: number, periodType: Period, movedFromOrderId: string) {
  return mock<OrderItem>({
    type: "rent",
    itemId: itemAId,
    amount,
    unitPrice: 100,
    periodFrom: DateTime.now(),
    periodTo: DateTime.now(),
    numberOfPeriods: 1,
    periodType,
    movedFromOrderId,
  });
}

let itemAId = "";

/** The placed order the moved order item came from; `paid` stubs whether it has payments. */
async function originalOrder(paid: boolean, payedAmount: number, periodType: Period) {
  const [branch, customer, item] = await Promise.all([createBranch(), createUser(), createItem()]);
  itemAId = item.id;
  const order = await createOrder({
    branchId: branch.id,
    customerId: customer.id,
    amount: payedAmount,
    orderItems: [
      {
        type: "rent",
        itemId: item.id,
        amount: payedAmount,
        unitPrice: 100,
        periodFrom: DateTime.now(),
        periodTo: DateTime.now(),
        numberOfPeriods: 1,
        periodType,
      },
    ],
  });
  paymentsExistStub.withArgs(order.id).resolves(paid);
  return order.id;
}

let paymentsExistStub: sinon.SinonStub;

test.group("OrderItemRentPeriodValidator", (group) => {
  const orderItemRentPeriodValidator = new OrderItemRentPeriodValidator();
  let sandbox: sinon.SinonSandbox;
  let branchPaymentInfo: any;

  group.each.setup(() => {
    branchPaymentInfo = {
      paymentResponsible: true,
    };
    sandbox = createSandbox();
    paymentsExistStub = sandbox.stub(Payment, "existFor").resolves(false);
    return testUtils.db().truncate();
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if period is not found on the branch", async ({ assert }) => {
    const paymentInfo = mock<Branch>({
      rentPeriods: [{ type: "year" }],
    });

    const orderItem = mock<OrderItem>({
      type: "rent",
      periodType: "semester",
    });

    return assert.rejects(
      () => orderItemRentPeriodValidator.validate(orderItem, paymentInfo, 100),
      BlError,
      /rent period "semester" is not valid on branch/,
    );
  });

  test("should reject if not all amounts is equal to 0 on orderItem", async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
      amount: 100,
      unitPrice: 80,
    });

    return assert.rejects(
      () => orderItemRentPeriodValidator.validate(orderItem, mock<Branch>(branchPaymentInfo), 100),
      BlError,
      /amounts where set on orderItem when branch is responsible/,
    );
  });

  test("should resolve with true if all amounts is 0", async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
      amount: 0,
      unitPrice: 0,
    });

    return assert.doesNotReject(() =>
      orderItemRentPeriodValidator.validate(orderItem, mock<Branch>(branchPaymentInfo), 100),
    );
  });

  // The movedFromOrder path: the customer changes an already-placed rent order, so the new
  // orderItem must be priced against what was payed on the original order. The branch charges
  // itemPrice * percentage (0.5 here) for a rent period.
  const movedPaymentInfo = mock<any>({
    paymentResponsible: false,
    rentPeriods: [
      {
        type: "semester",
        date: new Date(),
        maxNumberOfPeriods: 1,
        percentage: 0.5,
      },
    ],
  });

  test("should reject if the original order is not payed and orderItem.amount is 0", async ({
    assert,
  }) => {
    const orderId = await originalOrder(false, 100, "semester");

    return assert.rejects(
      () =>
        orderItemRentPeriodValidator.validate(
          movedOrderItem(0, "semester", orderId),
          movedPaymentInfo,
          100,
        ),
      BlError,
      /the original order has not been payed, but current orderItem.amount is "0"/,
    );
  });

  test("should reject if the period is the same but orderItem.amount is not 0", async ({
    assert,
  }) => {
    const orderId = await originalOrder(true, 100, "semester");

    return assert.rejects(
      () =>
        orderItemRentPeriodValidator.validate(
          movedOrderItem(100, "semester", orderId),
          movedPaymentInfo,
          100,
        ),
      BlError,
      /the original order has been payed, but current orderItem.amount is "100"/,
    );
  });

  test(
    "should reject if the period changed and orderItem.amount {amount} is not the new price minus the payed amount ({expected})",
  )
    .with([
      { amount: 100, payedAmount: 200, itemPrice: 500, expected: 50 },
      { amount: 0, payedAmount: 750, itemPrice: 1000, expected: -250 },
    ])
    .run(async ({ assert }, { amount, payedAmount, itemPrice, expected }) => {
      const orderId = await originalOrder(true, payedAmount, "year");

      return assert.rejects(
        () =>
          orderItemRentPeriodValidator.validate(
            movedOrderItem(amount, "semester", orderId),
            movedPaymentInfo,
            itemPrice,
          ),
        BlError,
        new RegExp(
          `orderItem amount is "${amount}" but should be "${expected}" since the old orderItem.amount was "${payedAmount}"`,
        ),
      );
    });

  test("should resolve if the period changed and orderItem.amount is the new price minus the payed amount", async ({
    assert,
  }) => {
    // new price is itemPrice 1000 * percentage 0.5 = 500, minus the 750 already payed = -250
    const orderId = await originalOrder(true, 750, "year");

    return assert.doesNotReject(() =>
      orderItemRentPeriodValidator.validate(
        movedOrderItem(-250, "semester", orderId),
        movedPaymentInfo,
        1000,
      ),
    );
  });

  test("should reject if orderItem.amount is not equalt to branchPayment percentage * itemPrice", async ({
    assert,
  }) => {
    const paymentInfo: any = {
      paymentResponsible: false,
      rentPeriods: [
        {
          type: "semester",
          date: new Date(),
          maxNumberOfPeriods: 1,
          percentage: 0.5,
        },
      ],
    };

    const itemPrice = 100;

    const orderItem = mock<OrderItem>({
      type: "rent",
      periodType: "semester",
      movedFromOrderId: null,
      amount: 0,
    });

    return assert.rejects(
      () => orderItemRentPeriodValidator.validate(orderItem, paymentInfo, itemPrice),
      BlError,
      /orderItem.amount "0" is not equal to itemPrice "100" \* percentage "0.5" "50"/,
    );
  });

  test("should resolve if given valid orderItem", async ({ assert }) => {
    const paymentInfo: any = {
      paymentResponsible: false,
      rentPeriods: [
        {
          type: "semester",
          date: new Date(),
          maxNumberOfPeriods: 1,
          percentage: 0.5,
        },
      ],
    };

    const itemPrice = 100;

    const orderItem = mock<OrderItem>({
      type: "rent",
      periodType: "semester",
      movedFromOrderId: null,
      amount: 50,
    });

    return assert.doesNotReject(() =>
      orderItemRentPeriodValidator.validate(orderItem, paymentInfo, itemPrice),
    );
  });
});
