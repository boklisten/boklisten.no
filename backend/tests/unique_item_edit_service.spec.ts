import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import { StorageService } from "#services/storage_service";
import { UniqueItemEditService } from "#services/unique_item_edit_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import { createItem } from "#tests/item_fixtures";
import { createUniqueItem } from "#tests/unique_item_fixtures";
import UniqueItem from "#models/unique_item";
import { mock, unchecked } from "#tests/test-doubles";

const BLID = "12345678";
const UNIQUE_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f70";
const OLD_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f71";
const NEW_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f72";
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const EMPLOYEE = { detailsId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const ADMIN = { detailsId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "admin" as const };

const heldCustomerItem = mock<CustomerItem>({
  id: "5f7f7f7f7f7f7f7f7f7f7f73",
  blid: BLID,
  item: OLD_ITEM_ID,
  customer: CUSTOMER_ID,
  handout: true,
  returned: false,
  buyout: false,
  cancel: false,
  buyback: false,
});
const returnedCustomerItem = mock<CustomerItem>({
  id: "5f7f7f7f7f7f7f7f7f7f7f74",
  blid: BLID,
  item: OLD_ITEM_ID,
  customer: CUSTOMER_ID,
  handout: true,
  returned: true,
  buyout: false,
  cancel: false,
  buyback: false,
});

test.group("UniqueItemEditService", (group) => {
  let sandbox: sinon.SinonSandbox;
  let report: sinon.SinonStub;
  let customerItems: sinon.SinonStub;
  let updateManyCustomerItems: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createItem({ id: OLD_ITEM_ID, title: "Sinus 1T" });
    await createItem({ id: NEW_ITEM_ID, title: "Sinus 1P" });
    sandbox = createSandbox();
    report = sandbox.stub(EmployeeMonitoringService, "report").resolves();
    await createUniqueItem({ id: UNIQUE_ITEM_ID, blid: BLID, itemId: OLD_ITEM_ID });
    customerItems = sandbox
      .stub(StorageService.CustomerItems, "getByQueryOrNull")
      .resolves([returnedCustomerItem]);
    updateManyCustomerItems = sandbox
      .stub(StorageService.CustomerItems, "updateMany")
      .resolves(unchecked({ matchedCount: 1, modifiedCount: 1 }));
  });
  group.each.teardown(() => sandbox.restore());

  test("relink writes the new item to the unique item and every customer item with the blid", async ({
    assert,
  }) => {
    await UniqueItemEditService.relink({ blid: BLID, itemId: NEW_ITEM_ID }, ADMIN);

    assert.equal((await UniqueItem.findOrFail(UNIQUE_ITEM_ID)).itemId, NEW_ITEM_ID);
    assert.isTrue(updateManyCustomerItems.calledOnce);
    assert.deepEqual(updateManyCustomerItems.firstCall.args[0], { blid: BLID });
    assert.equal(String(updateManyCustomerItems.firstCall.args[1].$set.item), NEW_ITEM_ID);
    assert.isFalse(report.called);
  });

  test("an employee's relink is reported with both titles and the current holder", async ({
    assert,
  }) => {
    customerItems.resolves([returnedCustomerItem, heldCustomerItem]);

    await UniqueItemEditService.relink({ blid: BLID, itemId: NEW_ITEM_ID }, EMPLOYEE);

    assert.isTrue(report.calledOnce);
    assert.deepEqual(report.firstCall.args[0], {
      action: "unique-item-relinked",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      details: [
        { label: "Unik ID", value: BLID },
        { label: "Gammel bok", value: "«Sinus 1T»" },
        { label: "Ny bok", value: "«Sinus 1P»" },
        { label: "Oppdaterte kundebøker", value: "1" },
      ],
    });
  });

  test("relink without a holder is reported without a customer", async ({ assert }) => {
    await UniqueItemEditService.relink({ blid: BLID, itemId: NEW_ITEM_ID }, EMPLOYEE);

    assert.equal(report.firstCall.args[0].customerId, null);
  });

  test("relink refuses the same book, an unknown book and an unknown blid", async ({ assert }) => {
    await assert.rejects(() =>
      UniqueItemEditService.relink({ blid: BLID, itemId: OLD_ITEM_ID }, ADMIN),
    );
    await assert.rejects(() =>
      UniqueItemEditService.relink({ blid: BLID, itemId: "5f7f7f7f7f7f7f7f7f7f7f99" }, ADMIN),
    );
    await assert.rejects(() =>
      UniqueItemEditService.relink({ blid: "00000000", itemId: NEW_ITEM_ID }, ADMIN),
    );

    assert.equal((await UniqueItem.findOrFail(UNIQUE_ITEM_ID)).itemId, OLD_ITEM_ID);
    assert.isFalse(updateManyCustomerItems.called);
  });

  test("delete removes the unique item and leaves the customer items alone", async ({ assert }) => {
    await UniqueItemEditService.remove({ blid: BLID }, ADMIN);

    assert.isNull(await UniqueItem.find(UNIQUE_ITEM_ID));
    assert.isFalse(updateManyCustomerItems.called);
    assert.isFalse(report.called);
  });

  test("an employee's delete is reported", async ({ assert }) => {
    await UniqueItemEditService.remove({ blid: BLID }, EMPLOYEE);

    assert.isTrue(report.calledOnce);
    assert.deepEqual(report.firstCall.args[0], {
      action: "unique-item-deleted",
      employee: EMPLOYEE,
      customerId: null,
      details: [
        { label: "Unik ID", value: BLID },
        { label: "Bok", value: "«Sinus 1T»" },
      ],
    });
  });

  test("delete refuses while a customer holds the book, and reports nothing", async ({
    assert,
  }) => {
    customerItems.resolves([returnedCustomerItem, heldCustomerItem]);

    await assert.rejects(() => UniqueItemEditService.remove({ blid: BLID }, EMPLOYEE));

    assert.isNotNull(await UniqueItem.find(UNIQUE_ITEM_ID));
    assert.isFalse(report.called);
  });

  test("delete refuses an unknown blid", async ({ assert }) => {
    await assert.rejects(() => UniqueItemEditService.remove({ blid: "00000000" }, ADMIN));

    assert.isNotNull(await UniqueItem.find(UNIQUE_ITEM_ID));
  });
});
