import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { BulkCollectionMonitoring } from "#services/bulk_collection_monitoring";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import { mock } from "#tests/test-doubles";

const EMPLOYEE = { detailsId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const IDA = "ida-id";
const PETRA = "petra-id";
const NOW = new Date("2026-09-06T12:00:00.000Z");

const titles = new Map([
  ["item-1", "Sinus 1T"],
  ["item-2", "Sinus 1P"],
]);

function customerItem(overrides: Partial<CustomerItem>): CustomerItem {
  return mock<CustomerItem>({
    id: "ci-1",
    item: "item-1",
    blid: "12345678",
    customer: IDA,
    deadline: new Date("2027-07-01T00:00:00.000Z"),
    ...overrides,
  });
}

test.group("BulkCollectionMonitoring.reportOverdueBooks", (group) => {
  let sandbox: sinon.SinonSandbox;
  let report: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    report = sandbox.stub(EmployeeMonitoringService, "report").resolves();
  });
  group.each.teardown(() => sandbox.restore());

  test("every overdue book is reported on its own, to its own customer", async ({ assert }) => {
    await BulkCollectionMonitoring.reportOverdueBooks({
      employee: EMPLOYEE,
      customerItems: [
        customerItem({ deadline: new Date("2026-06-30T22:00:00.000Z") }),
        customerItem({
          id: "ci-2",
          item: "item-2",
          blid: "87654321",
          customer: PETRA,
          deadline: new Date("2026-08-31T22:00:00.000Z"),
        }),
        customerItem({ id: "ci-3", blid: "11111111" }),
      ],
      titles,
      now: NOW,
    });

    assert.equal(report.callCount, 2);
    assert.deepEqual(report.firstCall.args[0], {
      action: "overdue-book-collected",
      employee: EMPLOYEE,
      customerId: IDA,
      details: [
        { label: "Bok", value: "«Sinus 1T»" },
        { label: "Unik ID", value: "12345678" },
        { label: "Frist", value: "01.07.2026" },
      ],
    });
    assert.deepEqual(report.secondCall.args[0], {
      action: "overdue-book-collected",
      employee: EMPLOYEE,
      customerId: PETRA,
      details: [
        { label: "Bok", value: "«Sinus 1P»" },
        { label: "Unik ID", value: "87654321" },
        { label: "Frist", value: "01.09.2026" },
      ],
    });
  });

  test("a book returned within the day of grace is not reported", async ({ assert }) => {
    await BulkCollectionMonitoring.reportOverdueBooks({
      employee: EMPLOYEE,
      customerItems: [customerItem({ deadline: new Date("2026-09-05T12:00:00.000Z") })],
      titles,
      now: NOW,
    });

    assert.isFalse(report.called);
  });
});
