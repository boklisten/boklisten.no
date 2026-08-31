import { test } from "@japa/runner";
import sinon, { createSandbox } from "sinon";

import { OrderFieldValidator } from "#services/legacy/collections/order/helpers/order-validator/order-field-validator/order-field-validator";
import { OrderItemBuyValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-buy-validator/order-item-buy-validator";
import { OrderItemExtendValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-extend-validator/order-item-extend-validator";
import { OrderItemRentValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-rent-validator/order-item-rent-validator";
import { OrderItemValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-validator";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { Branch } from "#shared/branch";
import { Item } from "#shared/item";
import { Order } from "#shared/order/order";
import { mock } from "#tests/test-doubles";

test.group("OrderItemValidator", (group) => {
  const orderItemFieldValidator = new OrderFieldValidator();
  const orderItemRentValidator = new OrderItemRentValidator();
  const orderItemBuyValidator = new OrderItemBuyValidator();
  const orderItemExtendValidator = new OrderItemExtendValidator();

  const orderItemValidator = new OrderItemValidator(
    orderItemFieldValidator,
    orderItemRentValidator,
    orderItemBuyValidator,
    orderItemExtendValidator,
  );

  let testOrder: Order;
  let testBranch: Branch;

  const legalDeadline = new Date();
  legalDeadline.setFullYear(legalDeadline.getFullYear() + 1);
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    testOrder = {
      id: "order1",
      amount: 300,
      customer: "",
      orderItems: [
        {
          item: "item2",
          title: "Spinn",
          amount: 300,
          unitPrice: 600,
          type: "rent",
          info: {
            from: new Date(),
            to: legalDeadline,
            numberOfPeriods: 1,
            periodType: "semester",
          },
        },
      ],
      delivery: "delivery1",
      branch: "branch1",
      byCustomer: true,
      placed: false,
      payments: ["payment1"],
    };

    testBranch = {
      id: "branch1",
      type: "privatist",
      name: "Sonans",
      branchItems: [],
      paymentInfo: {
        responsible: false,
        rentPeriods: [
          {
            type: "semester",
            date: new Date(),
            maxNumberOfPeriods: 0,
            percentage: 0.5,
          },
        ],
        extendPeriods: [
          {
            type: "semester",
            date: new Date(),
            maxNumberOfPeriods: 1,
            price: 100,
          },
        ],
        buyout: {
          percentage: 0.5,
        },
      },
      location: {
        region: "unknown",
      },
    };

    sandbox = createSandbox();
    sandbox.stub(orderItemRentValidator, "validate").callsFake(() => {
      return Promise.resolve(true);
    });

    sandbox.stub(orderItemBuyValidator, "validate").callsFake(() => {
      return Promise.resolve(true);
    });

    sandbox.stub(orderItemExtendValidator, "validate").callsFake(() => {
      return Promise.resolve(true);
    });

    sandbox.stub(StorageService.Branches, "get").callsFake((id) => {
      if (id !== "branch1") {
        return Promise.reject(new BlError("not found").code(702));
      }
      return Promise.resolve(testBranch);
    });

    sandbox.stub(StorageService.Items, "get").callsFake(() => {
      return Promise.resolve(mock<Item>({}));
    });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject with error when order.amount is 500 and total of orderItems is 250", async ({
    assert,
  }) => {
    testOrder.amount = 500;

    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].amount = 250;

    return assert.rejects(
      () => orderItemValidator.validate(testBranch, testOrder, false),
      BlError,
      /order.amount is "500" but total of orderItems amount is "250"/,
    );
  });

  test("should reject with error when order.amount is 100 and total of orderItems is 780", async ({
    assert,
  }) => {
    testOrder.amount = 100;

    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].amount = 780;

    return assert.rejects(
      () => orderItemValidator.validate(testBranch, testOrder, false),
      BlError,
      /order.amount is "100" but total of orderItems amount is "780"/,
    );
  });

  test("should resolve if price amount is valid", async ({ assert }) => {
    testOrder.orderItems = [
      {
        type: "rent",
        item: "item1",
        title: "signatur 3",
        amount: 100,
        unitPrice: 100,
        info: {
          to: legalDeadline,
        },
      },
    ];

    testOrder.amount = 100;

    return assert.doesNotReject(() => orderItemValidator.validate(testBranch, testOrder, false));
  });

  test("should reject if deadline is in the past and user is not admin", async ({ assert }) => {
    testOrder.orderItems = [
      {
        type: "rent",
        item: "item1",
        title: "signatur 3",
        amount: 100,
        unitPrice: 100,
        info: {
          to: new Date(1234567891011), // Friday, February 13th 2009
        },
      },
    ];
    testOrder.amount = 100;
    return assert.rejects(
      () => orderItemValidator.validate(testBranch, testOrder, false),
      BlError,
      /orderItem deadlines must be in the future/,
    );
  });

  test("should reject if deadline is more than four years into the future and user is not admin", async ({
    assert,
  }) => {
    const deadline = new Date();
    deadline.setFullYear(deadline.getFullYear() + 4);
    deadline.setDate(deadline.getDate() + 1);
    testOrder.orderItems = [
      {
        type: "rent",
        item: "item1",
        title: "signatur 3",
        amount: 100,
        unitPrice: 100,
        info: {
          to: deadline,
        },
      },
    ];
    testOrder.amount = 100;
    return assert.rejects(
      () => orderItemValidator.validate(testBranch, testOrder, false),
      BlError,
      /orderItem deadlines must less than two years into the future/,
    );
  });

  test("should fulfill if deadline is in the past and user is admin", async ({ assert }) => {
    testOrder.orderItems = [
      {
        type: "rent",
        item: "item1",
        title: "signatur 3",
        amount: 100,
        unitPrice: 100,
        info: {
          to: new Date(1234567891011), // Friday, February 13th 2009
        },
      },
    ];
    testOrder.amount = 100;
    return assert.doesNotReject(() => orderItemValidator.validate(testBranch, testOrder, true));
  });

  test("should fulfill if deadline is more than four years into the future and user is admin", async ({
    assert,
  }) => {
    const deadline = new Date();
    deadline.setFullYear(deadline.getFullYear() + 4);
    deadline.setDate(deadline.getDate() + 1);
    testOrder.orderItems = [
      {
        type: "rent",
        item: "item1",
        title: "signatur 3",
        amount: 100,
        unitPrice: 100,
        info: {
          to: deadline,
        },
      },
    ];
    testOrder.amount = 100;
    return assert.doesNotReject(() => orderItemValidator.validate(testBranch, testOrder, true));
  });
});
