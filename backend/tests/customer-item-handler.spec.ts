import { test } from "@japa/runner";
import mongoose from "mongoose";
import sinon, { createSandbox } from "sinon";

import { CustomerItemHandler } from "#services/legacy/collections/customer-item/helpers/customer-item-handler";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { Branch } from "#shared/branch";
import { CustomerItem } from "#shared/customer-item/customer-item";
import { OrderItem } from "#shared/order/order-item/order-item";
import { mock } from "#tests/test-doubles";

test.group("CustomerItemHandler", (group) => {
  const customerItemHandler = new CustomerItemHandler();

  let sandbox: sinon.SinonSandbox;
  let getCustomerItemStub: sinon.SinonStub;
  let getByQueryCustomerItemStub: sinon.SinonStub;
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
    getByQueryCustomerItemStub = customerItemsStub.getByQuery;
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
      (caught: unknown) => caught,
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
        (caught: unknown) => caught,
      );
    assert.equal(reason, 'orderItem.type is not "return"');
  });

  test('should reject if orderItem.type is not "buyback"', async ({ assert }) => {
    const orderItem = mock<OrderItem>({
      type: "rent",
    });
    const reason = await customerItemHandler.buyback("customerItem1", "order1", orderItem).then(
      () => null,
      (caught: unknown) => caught,
    );
    assert.equal(reason, 'orderItem.type is not "buyback"');
  });

  test("should return emtpy array if there are no customerItems", async ({ assert }) => {
    getByQueryCustomerItemStub.onFirstCall().resolves([]);

    const notReturnedCustomerItems = await customerItemHandler.getNotReturned(
      "5c33b6137eab87644f7e75e2",
      new Date(2012, 1, 1),
    );
    assert.deepEqual(notReturnedCustomerItems, []);
  });

  test("should ask db with correct query", async ({ assert }) => {
    const expectedQuery = new SEDbQuery();

    const before = new Date(2018, 11, 18);
    const deadline = new Date(2018, 11, 20);
    const after = new Date(2018, 11, 22);

    expectedQuery.dateFilters = [
      {
        fieldName: "deadline",
        op: {
          $gt: before,
          $lt: after,
        },
      },
    ];

    expectedQuery.objectIdFilters = [
      {
        fieldName: "customer",
        value: [
          "5c33b6137eab87644f7e75e2",
          new mongoose.Types.ObjectId("5c33b6137eab87644f7e75e2"),
        ],
      },
    ];

    expectedQuery.booleanFilters = [
      { fieldName: "returned", value: false },
      { fieldName: "buyout", value: false },
    ];

    getByQueryCustomerItemStub.withArgs(expectedQuery).resolves([]);

    await customerItemHandler.getNotReturned("5c33b6137eab87644f7e75e2", deadline);
    const queryArg = getByQueryCustomerItemStub.getCall(0).args[0];

    assert.deepEqual(queryArg.booleanFilters, expectedQuery.booleanFilters);

    assert.deepEqual(queryArg.objectIdFilters, expectedQuery.objectIdFilters);
  });

  test("should return customerItems not returned with the specified deadline", async ({
    assert,
  }) => {
    const customerItems = mock<CustomerItem[]>([
      {
        id: "1",
        item: "item1",
        deadline: new Date(2018, 11, 20),
        returned: false,
      },
      {
        id: "2",
        item: "item2",
        deadline: new Date(2018, 11, 20),
        returned: false,
      },
    ]);

    getByQueryCustomerItemStub.resolves(customerItems);

    const result = await customerItemHandler.getNotReturned(
      "5c33b6137eab87644f7e75e2",
      new Date(2018, 11, 20),
    );
    assert.deepEqual(result, customerItems);
  });

  test("should reject if BlStorage.CustomerItems rejects", async ({ assert }) => {
    getByQueryCustomerItemStub.rejects(new BlError("someting wrong"));

    return assert.rejects(
      () => customerItemHandler.getNotReturned("5c33b6137eab87644f7e75e2", new Date()),
      BlError,
    );
  });
});
