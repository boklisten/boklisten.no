import { test } from "@japa/runner";
import sinon, { createSandbox } from "sinon";

import { CustomerItemPostHook } from "#services/legacy/collections/customer-item/hooks/customer-item-post.hook";
import { CustomerItemValidator } from "#services/legacy/collections/customer-item/validators/customer-item-validator";
import { StorageService } from "#services/storage_service";
import { AccessToken } from "#shared/access-token";
import { BlError } from "#shared/bl-error";
import { CustomerItem } from "#shared/customer-item/customer-item";
import { Order } from "#shared/order/order";
import { UserDetail } from "#shared/user-detail";
import { mock } from "#tests/test-doubles";

test.group("CustomerItemPostHook", (group) => {
  let sandbox: sinon.SinonSandbox;
  let testCustomerItem: CustomerItem;
  let testOrder: Order;
  let testAccessToken: AccessToken;
  let validateCustomerItem: boolean;
  let testUserDetail: UserDetail;
  const customerItemValidator = new CustomerItemValidator();
  const customerItemPostHook = new CustomerItemPostHook(customerItemValidator);
  let orderUpdateStub: sinon.SinonStub;
  let userDetailStub: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    testAccessToken = mock<AccessToken>({
      sub: "user1",
      permission: "customer",
      details: "userDetail1",
    });

    testUserDetail = mock<UserDetail>({
      id: "userDetail1",
      name: "Alexander Hamilton",
      address: "Boston road 1c",
      postCode: "1234",
      postCity: "Boston",
      phone: "21212121",
      emailConfirmed: true,
      dob: new Date(1755, 1, 11),
      active: true,
      customerItems: [],
      branchMembership: "branch1",
    });

    testCustomerItem = {
      id: "customerItem1",
      customer: "userDetail1",
      item: "item1",
      deadline: new Date(),
      handout: true,
      handoutInfo: {
        handoutBy: "branch",
        handoutById: "branch1",
        handoutEmployee: "employee1",
        time: new Date(),
      },
      returned: false,
      orders: ["order1"],
    };

    testOrder = {
      id: "order1",
      amount: 100,
      orderItems: [
        {
          type: "rent",
          item: "item1",
          title: "Signatur 1",
          amount: 100,
          unitPrice: 400,
          info: {
            from: new Date(),
            to: new Date(),
            numberOfPeriods: 1,
            periodType: "semester",
          },
        },
      ],
      branch: "branch1",
      customer: "customer1",
      byCustomer: false,
      employee: "employee1",
      placed: true,
      payments: [],
    };

    validateCustomerItem = true;

    sandbox.stub(StorageService.Orders, "get").callsFake((id) => {
      if (id !== testOrder.id) {
        return Promise.reject(new BlError("order not found"));
      }
      return Promise.resolve(testOrder);
    });

    orderUpdateStub = sandbox.stub(StorageService.Orders, "update").callsFake(() => {
      return Promise.resolve(testOrder);
    });

    sandbox.stub(customerItemValidator, "validate").callsFake(() => {
      if (!validateCustomerItem) {
        return Promise.reject("could not validate");
      }
      return Promise.resolve(true);
    });

    sandbox.stub(StorageService.CustomerItems, "get").callsFake((id) => {
      if (id !== testCustomerItem.id) {
        return Promise.reject(new BlError("customerItem not found"));
      }
      return Promise.resolve(testCustomerItem);
    });

    sandbox.stub(StorageService.UserDetails, "get").callsFake((id) => {
      if (id !== testUserDetail.id) {
        return Promise.reject(new BlError("userDetail not found"));
      }

      return Promise.resolve(testUserDetail);
    });

    userDetailStub = sandbox.stub(StorageService.UserDetails, "update").callsFake(() => {
      return Promise.resolve(testUserDetail);
    });
  });

  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if customerItem parameter is undefined", async ({ assert }) => {
    return assert.rejects(
      () =>
        // @ts-expect-error fixme: auto ignored
        customerItemPostHook.before(undefined, testAccessToken),
      BlError,
      /customerItem is undefined/,
    );
  });

  test("should reject if customerItemValidator.validate rejects", async ({ assert }) => {
    validateCustomerItem = false;

    return assert.rejects(
      () => customerItemPostHook.before(testCustomerItem),
      BlError,
      "could not validate customerItem",
    );
  });

  test("should resolve with true if customerItemValidator.validate resolves", async ({
    assert,
  }) => {
    return assert.doesNotReject(() => customerItemPostHook.before(testCustomerItem));
  });

  test("should reject if userDetail is not valid", async ({ assert }) => {
    // @ts-expect-error fixme: auto ignored
    testUserDetail.name = null;

    // @ts-expect-error fixme: auto ignored
    testUserDetail.dob = null;

    return assert.rejects(
      () => customerItemPostHook.before(testCustomerItem),
      BlError,
      /userDetail "userDetail1" not valid/,
    );
  });

  test("should reject if customerItems are empty", async ({ assert }) => {
    return assert.rejects(
      () => customerItemPostHook.after([], testAccessToken),
      BlError,
      /customerItems is empty or undefined/,
    );
  });

  test("should reject if customerItem.customer is not defined", async ({ assert }) => {
    testCustomerItem.customer = "notFoundCustomer";

    return assert.rejects(
      () => customerItemPostHook.after([testCustomerItem], testAccessToken),
      BlError,
      /userDetail not found/,
    );
  });

  test("should update userDetail with the ids array if it was empty", async ({ assert }) => {
    testUserDetail.customerItems = [];
    await customerItemPostHook.after([testCustomerItem], testAccessToken);
    assert.isTrue(
      userDetailStub.calledWithMatch("userDetail1", {
        customerItems: ["customerItem1"],
      }),
    );
  });

  test("should add the new id to the old userDetail.customerItem array", async ({ assert }) => {
    testUserDetail.customerItems = ["customerItem2"];
    await customerItemPostHook.after([testCustomerItem], testAccessToken);
    assert.isTrue(
      userDetailStub.calledWith("userDetail1", {
        customerItems: ["customerItem2", "customerItem1"],
      }),
    );
  });

  test("should reject with error if customerItems.orders.length is over 1", async ({ assert }) => {
    testCustomerItem.orders = ["order1", "order2"];

    return assert.rejects(
      () => customerItemPostHook.after([testCustomerItem], testAccessToken),
      BlError,
      /customerItem.orders.length is "2" but should be "1"/,
    );
  });

  test("should update order.orderItems with the customerItem", async ({ assert }) => {
    testOrder.orderItems = [
      {
        type: "rent",
        item: "item1",
        title: "Signatur 1",
        amount: 100,
        unitPrice: 400,
        info: {
          from: new Date(),
          to: new Date(),
          numberOfPeriods: 1,
          periodType: "semester",
        },
      },
    ];

    const expectedOrderUpdateParameter = [
      {
        type: "rent",
        item: "item1",
        title: "Signatur 1",
        amount: 100,
        unitPrice: 400,
        info: {
          from: new Date(),
          to: new Date(),
          numberOfPeriods: 1,
          periodType: "semester",
          customerItem: "customerItem1", // expect to have this set
        },
      },
    ];

    await customerItemPostHook.after([testCustomerItem], testAccessToken);
    assert.isTrue(
      orderUpdateStub.calledWith("order1", {
        orderItems: expectedOrderUpdateParameter,
      }),
    );
  });
});
