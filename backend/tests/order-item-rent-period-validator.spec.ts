import { test } from "@japa/runner";
import sinon, { createSandbox } from "sinon";

import { OrderItemRentPeriodValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-rent-validator/order-item-rent-period-validator/order-item-rent-period-validator";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { BranchPaymentInfo } from "#shared/branch-payment-info";
import { OrderItem } from "#shared/order/order-item/order-item";
import { mock } from "#tests/test-doubles";

function movedOrderItem(amount: number, periodType: string) {
  return mock<any>({
    type: "rent",
    item: "itemA",
    amount,
    unitPrice: 100,
    info: {
      to: new Date(),
      from: new Date(),
      numberOfPeriods: 1,
      periodType,
    },
    movedFromOrder: "orderB",
  });
}

// payments non-empty together with placed true means the original order is payed for
function originalOrder(payments: string[], payedAmount: number, periodType: string) {
  return mock<any>({
    id: "orderB",
    amount: payedAmount,
    orderItems: [
      {
        type: "rent",
        item: "itemA",
        amount: payedAmount,
        unitPrice: 100,
        info: {
          to: new Date(),
          from: new Date(),
          numberOfPeriods: 1,
          periodType,
        },
      },
    ],
    payments,
    placed: true,
  });
}

test.group("OrderItemRentPeriodValidator", (group) => {
  const orderItemRentPeriodValidator = new OrderItemRentPeriodValidator();
  let orderStorageGetStub: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;
  let branchPaymentInfo: any;

  group.each.setup(() => {
    branchPaymentInfo = {
      responsible: true,
    };
    sandbox = createSandbox();
    orderStorageGetStub = sandbox.stub(StorageService.Orders, "get");
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if period is not found in branchPaymentInfo", async ({ assert }) => {
    const paymentInfo = mock<BranchPaymentInfo>({
      rentPeriods: [{ type: "year" }],
    });

    const orderItem = mock<OrderItem>({
      type: "rent",
      info: {
        periodType: "semester",
      },
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
      () =>
        orderItemRentPeriodValidator.validate(
          orderItem,
          mock<BranchPaymentInfo>(branchPaymentInfo),
          100,
        ),
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
      orderItemRentPeriodValidator.validate(
        orderItem,
        mock<BranchPaymentInfo>(branchPaymentInfo),
        100,
      ),
    );
  });

  // The movedFromOrder path: the customer changes an already-placed rent order, so the new
  // orderItem must be priced against what was payed on the original order. The branch charges
  // itemPrice * percentage (0.5 here) for a rent period.
  const movedPaymentInfo = mock<any>({
    responsible: false,
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
    orderStorageGetStub.withArgs("orderB").resolves(originalOrder([], 100, "semester"));

    return assert.rejects(
      () =>
        orderItemRentPeriodValidator.validate(movedOrderItem(0, "semester"), movedPaymentInfo, 100),
      BlError,
      /the original order has not been payed, but current orderItem.amount is "0"/,
    );
  });

  test("should reject if the period is the same but orderItem.amount is not 0", async ({
    assert,
  }) => {
    orderStorageGetStub.withArgs("orderB").resolves(originalOrder(["payment1"], 100, "semester"));

    return assert.rejects(
      () =>
        orderItemRentPeriodValidator.validate(
          movedOrderItem(100, "semester"),
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
    .run(({ assert }, { amount, payedAmount, itemPrice, expected }) => {
      orderStorageGetStub
        .withArgs("orderB")
        .resolves(originalOrder(["payment1"], payedAmount, "year"));

      return assert.rejects(
        () =>
          orderItemRentPeriodValidator.validate(
            movedOrderItem(amount, "semester"),
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
    orderStorageGetStub.withArgs("orderB").resolves(originalOrder(["payment1"], 750, "year"));

    return assert.doesNotReject(() =>
      orderItemRentPeriodValidator.validate(
        movedOrderItem(-250, "semester"),
        movedPaymentInfo,
        1000,
      ),
    );
  });

  test("should reject if orderItem.amount is not equalt to branchPayment percentage * itemPrice", async ({
    assert,
  }) => {
    const paymentInfo: any = {
      responsible: false,
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

    const orderItem: any = {
      type: "rent",
      info: {
        periodType: "semester",
      },
      amount: 0,
    };

    return assert.rejects(
      () => orderItemRentPeriodValidator.validate(orderItem, paymentInfo, itemPrice),
      BlError,
      /orderItem.amount "0" is not equal to itemPrice "100" \* percentage "0.5" "50"/,
    );
  });

  test("should resolve if given valid orderItem", async ({ assert }) => {
    const paymentInfo: any = {
      responsible: false,
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

    const orderItem: any = {
      type: "rent",
      info: {
        periodType: "semester",
      },
      amount: 50,
    };

    return assert.doesNotReject(() =>
      orderItemRentPeriodValidator.validate(orderItem, paymentInfo, itemPrice),
    );
  });
});
