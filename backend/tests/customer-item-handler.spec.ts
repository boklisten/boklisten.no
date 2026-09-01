import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { CustomerItemHandler } from "#services/legacy/collections/customer-item/helpers/customer-item-handler";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { OrderItem } from "#shared/order/order-item/order-item";
import { mock } from "#tests/test-doubles";

test.group("CustomerItemHandler", (group) => {
  const customerItemHandler = new CustomerItemHandler();

  let sandbox: sinon.SinonSandbox;
  let getCustomerItemStub: sinon.SinonStub;
  let getBranchStub: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    const customerItemsStub = {
      get: sandbox.stub(),
      getByQuery: sandbox.stub(),
    };
    const branchesStub = {
      get: sandbox.stub(),
    };

    sandbox.stub(StorageService, "CustomerItems").value(customerItemsStub);
    sandbox.stub(StorageService, "Branches").value(branchesStub);

    getCustomerItemStub = customerItemsStub.get;
    getBranchStub = branchesStub.get;
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

    const branch = mock<Branch>({
      paymentInfo: {
        extendPeriods: [
          {
            type: "semester",
            date: new Date(),
            maxNumberOfPeriods: 1,
            price: 100,
          },
        ],
      },
    });

    getBranchStub.withArgs("branch1").resolves(branch);

    return assert.rejects(
      () => customerItemHandler.extend("customerItem1", orderItem, "branch1", "order1"),
      BlError,
      /extend period "year" is not present on branch/,
    );
  });

  // These three paths throw a plain string, which assert.rejects cannot match on, so compare the
  // rejection reason directly.
  test('should reject if orderItem.type is not "buyout"', async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
    });
    const reason = await customerItemHandler.buyout("customerItem1", "order1", orderItem).then(
      () => null,
      (error: unknown) => error,
    );
    assert.equal(reason, 'orderItem.type is not "buyout"');
  });

  test('should reject if orderItem.type is not "return"', async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
    });
    const reason = await customerItemHandler
      .return("customerItem1", "order1", orderItem, "branch1", "employee1")
      .then(
        () => null,
        (error: unknown) => error,
      );
    assert.equal(reason, 'orderItem.type is not "return"');
  });

  test('should reject if orderItem.type is not "buyback"', async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
    });
    const reason = await customerItemHandler.buyback("customerItem1", "order1", orderItem).then(
      () => null,
      (error: unknown) => error,
    );
    assert.equal(reason, 'orderItem.type is not "buyback"');
  });
});
