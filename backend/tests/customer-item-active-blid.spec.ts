import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { CustomerItemActiveBlid } from "#services/legacy/collections/customer-item/helpers/customer-item-active-blid";
import { StorageService } from "#services/storage_service";
import { asStub } from "#tests/test-doubles";

test.group("CustomerItemActiveBlid", (group) => {
  let sandbox: sinon.SinonSandbox;
  let customerItemActiveBlid: CustomerItemActiveBlid;

  group.each.setup(() => {
    sandbox = createSandbox();
    const customerItemsStub = {
      getByQuery: sandbox.stub(),
    };
    sandbox.stub(StorageService, "CustomerItems").value(customerItemsStub);
    customerItemActiveBlid = new CustomerItemActiveBlid();
  });

  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should resolve true if one customerItem is active", async ({ assert }) => {
    const customerItem1 = {
      id: "customerItem1",
      item: "item1",
      blid: "blid1",
      customer: "customer1",
      deadline: new Date(),
      handout: true,
      returned: false,
    };

    const customerItem2 = {
      id: "customerItem2",
      item: "item2",
      blid: "blid1",
      customer: "customer2",
      deadline: new Date(),
      handout: true,
      returned: true,
    };

    // Grab our stub and define the return value for THIS test
    const getByQueryStub = asStub(StorageService.CustomerItems.getByQuery);
    getByQueryStub.resolves([customerItem1, customerItem2]);

    const result = await customerItemActiveBlid.getActiveCustomerItemIds("blid1");
    assert.deepEqual(result, ["customerItem1"]);
  });

  test("should resolve false if no customerItem is active", async ({ assert }) => {
    const customerItem = {
      id: "customerItem1",
      item: "item1",
      blid: "blid1",
      customer: "customer1",
      deadline: new Date(),
      handout: true,
      returned: true,
    };

    // For this test, the same stub returns a different result
    const getByQueryStub = asStub(StorageService.CustomerItems.getByQuery);
    getByQueryStub.resolves([customerItem]);

    const result = await customerItemActiveBlid.getActiveCustomerItemIds("blid1");
    assert.deepEqual(result, []);
  });
});
