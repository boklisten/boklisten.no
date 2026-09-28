import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import CustomerItem from "#models/customer_item";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import { UniqueItemEditService } from "#services/unique_item_edit_service";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createUniqueItem } from "#tests/unique_item_fixtures";
import UniqueItem from "#models/unique_item";
import { createUser } from "#tests/user_fixtures";

const BLID = "12345678";
const UNIQUE_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f70";
const OLD_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f71";
const NEW_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f72";
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const EMPLOYEE = { userId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const ADMIN = { userId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "admin" as const };

const BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f75";

/** A copy of the book carrying the blid; an earlier loan of it is returned in every test. */
function copy(returned: boolean) {
  return createCustomerItem({
    blid: BLID,
    itemId: OLD_ITEM_ID,
    customerId: CUSTOMER_ID,
    handoutBranchId: BRANCH_ID,
    returned,
  });
}

/** The item every customer item with the blid points at. */
async function customerItemTitles() {
  const customerItems = await CustomerItem.query().where("blid", BLID);
  return [...new Set(customerItems.map((customerItem) => customerItem.itemId))];
}

test.group("UniqueItemEditService", (group) => {
  let sandbox: sinon.SinonSandbox;
  let report: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createItem({ id: OLD_ITEM_ID, title: "Sinus 1T" });
    await createItem({ id: NEW_ITEM_ID, title: "Sinus 1P" });
    sandbox = createSandbox();
    report = sandbox.stub(EmployeeMonitoringService, "report").resolves();
    await createUniqueItem({ id: UNIQUE_ITEM_ID, blid: BLID, itemId: OLD_ITEM_ID });
    await createBranch({ id: BRANCH_ID });
    await createUser({ id: CUSTOMER_ID });
    await copy(true);
  });
  group.each.teardown(() => sandbox.restore());

  test("relink writes the new item to the unique item and every customer item with the blid", async ({
    assert,
  }) => {
    await UniqueItemEditService.relink({ blid: BLID, itemId: NEW_ITEM_ID }, ADMIN);

    assert.equal((await UniqueItem.findOrFail(UNIQUE_ITEM_ID)).itemId, NEW_ITEM_ID);
    assert.deepEqual(await customerItemTitles(), [NEW_ITEM_ID]);
    assert.isFalse(report.called);
  });

  test("an employee's relink is reported with both titles and the current holder", async ({
    assert,
  }) => {
    await copy(false);

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
        { label: "Oppdaterte kundebøker", value: "2" },
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
    assert.deepEqual(await customerItemTitles(), [OLD_ITEM_ID]);
  });

  test("delete removes a unique item no customer item carries", async ({ assert }) => {
    await CustomerItem.query().where("blid", BLID).delete();
    await UniqueItemEditService.remove({ blid: BLID }, ADMIN);

    assert.isNull(await UniqueItem.find(UNIQUE_ITEM_ID));
    assert.isFalse(report.called);
  });

  test("delete refuses a blid with returned customer items, and reports nothing", async ({
    assert,
  }) => {
    await assert.rejects(
      () => UniqueItemEditService.remove({ blid: BLID }, EMPLOYEE),
      /har vært utlånt/,
    );

    assert.isNotNull(await UniqueItem.find(UNIQUE_ITEM_ID));
    assert.deepEqual(await customerItemTitles(), [OLD_ITEM_ID]);
    assert.isFalse(report.called);
  });

  test("an employee's delete is reported", async ({ assert }) => {
    await CustomerItem.query().where("blid", BLID).delete();
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
    await copy(false);

    await assert.rejects(() => UniqueItemEditService.remove({ blid: BLID }, EMPLOYEE));

    assert.isNotNull(await UniqueItem.find(UNIQUE_ITEM_ID));
    assert.isFalse(report.called);
  });

  test("delete refuses an unknown blid", async ({ assert }) => {
    await assert.rejects(() => UniqueItemEditService.remove({ blid: "00000000" }, ADMIN));

    assert.isNotNull(await UniqueItem.find(UNIQUE_ITEM_ID));
  });
});
