import { test } from "@japa/runner";
import sinon from "sinon";

import { CustomerItemActiveBlid } from "#services/legacy/collections/customer-item/helpers/customer-item-active-blid";
import { UniqueItemActiveOperation } from "#services/legacy/collections/unique-item/operations/unique-item-active.operation";
import { StorageService } from "#services/storage_service";
import { UniqueItem } from "#shared/unique-item";

test.group("UniqueItemActiveOperation", (group) => {
  const customerItemActiveBlid = new CustomerItemActiveBlid();

  const uniqueItemActiveOperation = new UniqueItemActiveOperation(customerItemActiveBlid);

  let sandbox: sinon.SinonSandbox;
  let getUniqueItemStub: sinon.SinonStub;
  let getActiveCustomerItemsStub: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = sinon.createSandbox();
    getActiveCustomerItemsStub = sandbox.stub(customerItemActiveBlid, "getActiveCustomerItems");

    getUniqueItemStub = sandbox.stub(StorageService.UniqueItems, "get");
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should not reject", async ({ assert }) => {
    getUniqueItemStub.resolves({ blid: "blid1" } as UniqueItem);

    getActiveCustomerItemsStub.resolves([]);

    return assert.doesNotReject(() =>
      uniqueItemActiveOperation.run({
        documentId: "uniqueItem1",
      }),
    );
  });
});
