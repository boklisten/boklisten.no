import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { BlidSearchService } from "#services/blid_search_service";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import { StorageService } from "#services/storage_service";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Item } from "#shared/item";
import { mock, unchecked } from "#tests/test-doubles";

const CUSTOMER_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f70";
const OLD_BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f71";
const NEW_BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f72";
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const EMPLOYEE = { detailsId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const ADMIN = { detailsId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "admin" as const };

const branches: Record<string, Branch> = {
  [OLD_BRANCH_ID]: mock<Branch>({ id: OLD_BRANCH_ID, name: "Ullern VGS" }),
  [NEW_BRANCH_ID]: mock<Branch>({ id: NEW_BRANCH_ID, name: "Persbråten VGS" }),
};

test.group("BlidSearchService.updateActiveItem()", (group) => {
  let sandbox: sinon.SinonSandbox;
  let report: sinon.SinonStub;
  let updateMany: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    report = sandbox.stub(EmployeeMonitoringService, "report").resolves();
    updateMany = sandbox
      .stub(StorageService.CustomerItems, "updateMany")
      .resolves(unchecked({ matchedCount: 1 }));
    sandbox.stub(StorageService.CustomerItems, "getOrNull").resolves(
      mock<CustomerItem>({
        id: CUSTOMER_ITEM_ID,
        item: "item-1",
        blid: "12345678",
        customer: CUSTOMER_ID,
        deadline: new Date("2026-06-30T22:00:00.000Z"),
        handoutInfo: { handoutBy: "branch", handoutById: OLD_BRANCH_ID },
      }),
    );
    sandbox
      .stub(StorageService.Items, "getOrNull")
      .resolves(mock<Item>({ id: "item-1", title: "Sinus 1T" }));
    sandbox
      .stub(StorageService.Branches, "getOrNull")
      .callsFake((id) => Promise.resolve(id === undefined ? null : (branches[id] ?? null)));
  });
  group.each.teardown(() => sandbox.restore());

  test("a changed deadline is written and reported with the old and new date", async ({
    assert,
  }) => {
    await BlidSearchService.updateActiveItem(
      { customerItemId: CUSTOMER_ITEM_ID, deadline: "2026-12-19T23:00:00.000Z" },
      EMPLOYEE,
    );

    assert.isTrue(updateMany.calledOnce);
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
      { customerItemId: CUSTOMER_ITEM_ID, deadline: "2026-12-19T23:00:00.000Z" },
      ADMIN,
    );

    assert.isTrue(updateMany.calledOnce);
    assert.isFalse(report.called);
  });

  test("refuses when the book is not actively handed out, and reports nothing", async ({
    assert,
  }) => {
    updateMany.resolves(unchecked({ matchedCount: 0 }));

    await assert.rejects(() =>
      BlidSearchService.updateActiveItem(
        { customerItemId: CUSTOMER_ITEM_ID, deadline: "2026-12-19T23:00:00.000Z" },
        EMPLOYEE,
      ),
    );

    assert.isFalse(report.called);
  });
});
