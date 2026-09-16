import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { CustomerItemHandler } from "#services/customer_items/customer_item_handler";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { OrderItem } from "#shared/order/order-item/order-item";
import { createBranch } from "#tests/branch_fixtures";
import { mock } from "#tests/test-doubles";

test.group("CustomerItemHandler", (group) => {
  const customerItemHandler = new CustomerItemHandler();

  let sandbox: sinon.SinonSandbox;
  let getCustomerItemStub: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    const customerItemsStub = {
      get: sandbox.stub(),
      getByQuery: sandbox.stub(),
    };

    sandbox.stub(StorageService, "CustomerItems").value(customerItemsStub);

    getCustomerItemStub = customerItemsStub.get;
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should reject if returned is true", async ({ assert }) => {
    const customerItem = mock<CustomerItem>({
      deadline: new Date(),
      handout: true,
      returned: true,
    });

    getCustomerItemStub.withArgs("customerItem1").resolves(customerItem);

    const orderItem = mock<OrderItem>({});

    return assert.rejects(
      () => customerItemHandler.extend("customerItem1", orderItem, "branch1", "order1"),
      BlError,
      /can not extend when returned is true/,
    );
  });

  test("should reject if orderItem.type is not extend", async ({ assert }) => {
    const customerItem = mock<CustomerItem>({
      deadline: new Date(),
      handout: true,
      returned: false,
    });

    getCustomerItemStub.withArgs("customerItem1").resolves(customerItem);

    const orderItem = mock<OrderItem>({
      type: "rent",
    });

    return assert.rejects(
      () => customerItemHandler.extend("customerItem1", orderItem, "branch1", "order1"),
      BlError,
      /orderItem.type is not "extend"/,
    );
  });

  test("should reject if branch does not have the extend period", async ({ assert }) => {
    const customerItem = mock<CustomerItem>({
      deadline: new Date(),
      handout: true,
      returned: false,
    });

    getCustomerItemStub.withArgs("customerItem1").resolves(customerItem);

    const orderItem = mock<OrderItem>({
      type: "extend",
      info: {
        from: new Date(),
        to: new Date(),
        numberOfPeriods: 1,
        periodType: "year",
        customerItem: "customerItem1",
      },
    });

    await createBranch({
      id: "branch1",
      extendPeriods: [
        { type: "semester", date: new Date(), maxNumberOfPeriods: 1, price: 100, percentage: null },
      ],
    });

    return assert.rejects(
      () => customerItemHandler.extend("customerItem1", orderItem, "branch1", "order1"),
      BlError,
      /extend period "year" is not present on branch/,
    );
  });

  test('should reject if orderItem.type is not "buyout"', async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
    });
    await assert.rejects(
      () => customerItemHandler.buyout("customerItem1", "order1", orderItem),
      BlError,
      /orderItem.type is not "buyout"/,
    );
  });

  test('should reject if orderItem.type is not "return"', async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
    });
    await assert.rejects(
      () =>
        customerItemHandler.return("customerItem1", "order1", orderItem, "branch1", "employee1"),
      BlError,
      /orderItem.type is not "return"/,
    );
  });

  test('should reject if orderItem.type is not "buyback"', async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
    });
    await assert.rejects(
      () => customerItemHandler.buyback("customerItem1", "order1", orderItem),
      BlError,
      /orderItem.type is not "buyback"/,
    );
  });
});
