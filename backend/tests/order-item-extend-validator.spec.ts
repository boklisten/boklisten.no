import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { OrderItemExtendValidator } from "#services/legacy/collections/order/helpers/order-validator/order-item-validator/order-item-extend-validator/order-item-extend-validator";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Order } from "#shared/order/order";

test.group("OrderItemExtendValidator", (group) => {
  const orderItemExtendValidator = new OrderItemExtendValidator();

  let testOrder: Order;

  let testBranch: Branch;
  let testCustomerItem: CustomerItem;
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.CustomerItems, "get").callsFake((id) => {
      if (id !== testCustomerItem.id) {
        return Promise.reject(new BlError("not found").code(702));
      }
      return Promise.resolve(testCustomerItem);
    });

    testCustomerItem = {
      id: "customerItem1",
      item: "item1",
      type: "rent",
      deadline: new Date(),
      handout: true,
      customer: "customer1",
      handoutInfo: {
        handoutBy: "branch",
        handoutById: "branch1",
        handoutEmployee: "employee1",
        time: new Date(),
      },
      returned: false,
      periodExtends: [
        {
          from: new Date(),
          to: new Date(),
          periodType: "year",
          time: new Date(),
        },
      ],
    };

    testOrder = {
      id: "order1",
      amount: 100,
      customer: "",
      orderItems: [
        {
          item: "item1",
          title: "Spinn",
          amount: 100,
          unitPrice: 100,
          type: "extend",
          info: {
            from: new Date(),
            to: new Date(),
            numberOfPeriods: 1,
            periodType: "semester",
            customerItem: "customerItem1",
          },
        },
      ],
      delivery: "delivery1",
      branch: "branch1",
      byCustomer: true,
      placed: false,
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
            maxNumberOfPeriods: 2,
            date: new Date(),
            percentage: 0.5,
          },
        ],
        extendPeriods: [
          {
            type: "semester",
            maxNumberOfPeriods: 1,
            date: new Date(),
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
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test('should reject if orderItem.type is not "extend"', async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].type = "rent";
    return assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        orderItemExtendValidator.validate(testBranch, testOrder.orderItems[0]),
      BlError,
      /orderItem.type "rent" is not "extend"/,
    );
  });

  test("should reject if orderItem.info.periodType is not allowed at branch", async ({
    assert,
  }) => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].info.periodType = "year";

    // @ts-expect-error fixme: auto ignored
    testBranch.paymentInfo.extendPeriods = [
      {
        type: "semester",
        price: 100,
        date: new Date(),
        maxNumberOfPeriods: 1,
      },
    ];

    return assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        orderItemExtendValidator.validate(testBranch, testOrder.orderItems[0]),
      BlError,
      /orderItem.info.periodType is "year" but it is not allowed by branch/,
    );
  });

  test("should reject if orderItem.info.numberOfPeriods is greater than the maxNumberOfPeriods on branch", async () => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].info.numberOfPeriods = 3;

    // @ts-expect-error fixme: auto ignored
    testBranch.paymentInfo.extendPeriods = [
      {
        type: "semester",
        price: 100,
        date: new Date(),
        maxNumberOfPeriods: 1,
      },
    ];
  });

  test("should reject if orderItem.info is not defined", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].info = null;

    return assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        orderItemExtendValidator.validate(testBranch, testOrder.orderItems[0]),
      BlError,
      /orderItem.info is not defined/,
    );
  });

  test("should reject if orderItem.customerItem is not defined", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].info.customerItem = null;

    return assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        orderItemExtendValidator.validate(testBranch, testOrder.orderItems[0]),
      BlError,
      /orderItem.info.customerItem is not defined/,
    );
  });

  test("should reject when customerItem have been extended to many times", async ({ assert }) => {
    testCustomerItem.id = "maxExtendedCustomerItem";

    // @ts-expect-error fixme: auto ignored
    testBranch.paymentInfo.extendPeriods = [
      {
        type: "semester",
        price: 100,
        date: new Date(),
        maxNumberOfPeriods: 1,
      },
    ];

    testCustomerItem.periodExtends = [
      {
        from: new Date(),
        to: new Date(),
        periodType: "semester",
        time: new Date(),
      },
      {
        from: new Date(),
        to: new Date(),
        periodType: "semester",
        time: new Date(),
      },
    ];
    // @ts-expect-error fixme: auto ignored
    testOrder.orderItems[0].info.customerItem = "maxExtendedCustomerItem";

    return assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        orderItemExtendValidator.validate(testBranch, testOrder.orderItems[0]),
      BlError,
      /orderItem can not be extended any more times/,
    );
  });
});
