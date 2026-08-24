import { test } from "@japa/runner";
import sinon, { createSandbox } from "sinon";

import { CustomerHaveActiveCustomerItems } from "#services/legacy/collections/customer-item/helpers/customer-have-active-customer-items";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { CustomerItem } from "#shared/customer-item/customer-item";

test.group("CustomerHaveActiveCustomerItems", (group) => {
  const customerHaveActiveCustomerItems = new CustomerHaveActiveCustomerItems();

  const testUserId = "5d765db5fc8c47001c408d8d";

  let sandbox: sinon.SinonSandbox;
  let customerItemByQueryStub: sinon.SinonStub;
  group.each.setup(() => {
    sandbox = createSandbox();
    customerItemByQueryStub = sandbox.stub(StorageService.CustomerItems, "getByQuery");
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should resolve with false if no customerItems is found", async ({ assert }) => {
    customerItemByQueryStub.rejects(new BlError("not found").code(702));

    assert.isFalse(await customerHaveActiveCustomerItems.haveActiveCustomerItems(testUserId));
  });

  test("should resolve with false if no customerItems was active", async ({ assert }) => {
    const nonActiveCustomerItem: CustomerItem = {
      id: "customerItem1",
      item: "item1",
      deadline: new Date(),
      customer: testUserId,
      handout: true,
      returned: true,
    };

    customerItemByQueryStub.resolves([nonActiveCustomerItem]);

    assert.isFalse(await customerHaveActiveCustomerItems.haveActiveCustomerItems(testUserId));
  });

  test("should resolve with true if at least one customerItem was active", async ({ assert }) => {
    const nonActiveCustomerItem: CustomerItem = {
      id: "customerItem1",
      item: "item1",
      deadline: new Date(),
      customer: testUserId,
      handout: true,
      returned: true,
    };

    const activeCustomerItem: CustomerItem = {
      id: "customerItem1",
      item: "item1",
      deadline: new Date(),
      customer: testUserId,
      handout: true,
      returned: false,
    };

    customerItemByQueryStub.resolves([nonActiveCustomerItem, activeCustomerItem]);

    assert.isTrue(await customerHaveActiveCustomerItems.haveActiveCustomerItems(testUserId));
  });
});
