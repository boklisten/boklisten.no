import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import CustomerItem from "#models/customer_item";
import { BlidSearchService } from "#services/blid_search_service";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import { fixtureId } from "#tests/fixtures";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createUniqueItem } from "#tests/unique_item_fixtures";
import { createUser } from "#tests/user_fixtures";

const CUSTOMER_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f70";
const OLD_BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f71";
const NEW_BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f72";
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const EMPLOYEE = { userId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const ADMIN = { userId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "admin" as const };

const ITEM_ID = fixtureId("1");

test.group("BlidSearchService.updateActiveItem()", (group) => {
  let sandbox: sinon.SinonSandbox;
  let report: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createItem({ id: ITEM_ID, title: "Sinus 1T" });
    await createBranch({ id: OLD_BRANCH_ID, name: "Ullern VGS" });
    await createBranch({ id: NEW_BRANCH_ID, name: "Persbråten VGS" });
    await createUser({ id: CUSTOMER_ID });
    await createCustomerItem({
      id: CUSTOMER_ITEM_ID,
      itemId: ITEM_ID,
      blid: "12345678",
      customerId: CUSTOMER_ID,
      deadline: DateTime.fromISO("2026-07-01"),
      handoutBranchId: OLD_BRANCH_ID,
    });
    sandbox = createSandbox();
    report = sandbox.stub(EmployeeMonitoringService, "report").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("a changed deadline is written and reported with the old and new date", async ({
    assert,
  }) => {
    await BlidSearchService.updateActiveItem(
      { customerItemId: CUSTOMER_ITEM_ID, deadline: "2026-12-20" },
      EMPLOYEE,
    );

    assert.equal(
      (await CustomerItem.findOrFail(CUSTOMER_ITEM_ID)).deadline.toISODate(),
      "2026-12-20",
    );
    assert.isTrue(report.calledOnce);
    assert.deepEqual(report.firstCall.args[0], {
      action: "active-item-deadline-changed",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      details: [
        { label: "Bok", value: "«Sinus 1T»" },
        { label: "Unik ID", value: "12345678" },
        { label: "Gammel frist", value: "01.07.2026" },
        { label: "Ny frist", value: "20.12.2026" },
      ],
    });
  });

  test("a changed branch is reported with both branch names", async ({ assert }) => {
    await BlidSearchService.updateActiveItem(
      { customerItemId: CUSTOMER_ITEM_ID, branchId: NEW_BRANCH_ID },
      EMPLOYEE,
    );

    assert.equal((await CustomerItem.findOrFail(CUSTOMER_ITEM_ID)).handoutBranchId, NEW_BRANCH_ID);

    assert.isTrue(report.calledOnce);
    assert.deepEqual(report.firstCall.args[0], {
      action: "active-item-branch-changed",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
      details: [
        { label: "Bok", value: "«Sinus 1T»" },
        { label: "Unik ID", value: "12345678" },
        { label: "Gammel filial", value: "Ullern VGS" },
        { label: "Ny filial", value: "Persbråten VGS" },
      ],
    });
  });

  test("an admin's change is written but never reported", async ({ assert }) => {
    await BlidSearchService.updateActiveItem(
      { customerItemId: CUSTOMER_ITEM_ID, deadline: "2026-12-20" },
      ADMIN,
    );

    assert.equal(
      (await CustomerItem.findOrFail(CUSTOMER_ITEM_ID)).deadline.toISODate(),
      "2026-12-20",
    );
    assert.isFalse(report.called);
  });

  test("refuses when the book is not actively handed out, and reports nothing", async ({
    assert,
  }) => {
    await CustomerItem.query().where("id", CUSTOMER_ITEM_ID).update({ returned: true });

    await assert.rejects(() =>
      BlidSearchService.updateActiveItem(
        { customerItemId: CUSTOMER_ITEM_ID, deadline: "2026-12-20" },
        EMPLOYEE,
      ),
    );

    assert.isFalse(report.called);
  });
});

test.group("BlidSearchService.search()", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("ranks held copies first and names their holder", async ({ assert }) => {
    await createItem({ id: ITEM_ID, title: "Sinus 1T" });
    await createBranch({ id: OLD_BRANCH_ID });
    await createUser({ id: CUSTOMER_ID, name: "Ida Holder" });
    await createUniqueItem({ itemId: ITEM_ID, blid: "12345679" });
    await createUniqueItem({ itemId: ITEM_ID, blid: "12345678" });
    await createCustomerItem({
      itemId: ITEM_ID,
      blid: "12345679",
      customerId: CUSTOMER_ID,
      handoutBranchId: OLD_BRANCH_ID,
    });

    const { hits } = await BlidSearchService.search("1234567");

    assert.deepEqual(
      hits.map((hit) => [hit.blid, hit.holder?.name ?? null]),
      [
        ["12345679", "Ida Holder"],
        ["12345678", null],
      ],
    );
  });
});
