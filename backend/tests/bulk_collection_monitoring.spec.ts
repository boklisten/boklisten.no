import { test } from "@japa/runner";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { BulkCollectionMonitoring } from "#services/bulk_collection_monitoring";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import type CustomerItem from "#models/customer_item";
import { customerItemDouble } from "#tests/customer_item_fixtures";

const EMPLOYEE = { userId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const IDA = "ida-id";
const PETRA = "petra-id";
const NOW = new Date("2026-09-06T12:00:00.000Z");

const titles = new Map([
  ["item-1", "Sinus 1T"],
  ["item-2", "Sinus 1P"],
]);

function customerItem({
  deadline = "2027-07-01",
  ...overrides
}: Partial<Pick<CustomerItem, "id" | "itemId" | "blid" | "customerId">> & {
  deadline?: string;
}): CustomerItem {
  return customerItemDouble({
    id: "ci-1",
    itemId: "item-1",
    blid: "12345678",
    customerId: IDA,
    deadline: DateTime.fromISO(deadline),
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
        customerItem({ deadline: "2026-07-01" }),
        customerItem({
          id: "ci-2",
          itemId: "item-2",
          blid: "87654321",
          customerId: PETRA,
          deadline: "2026-09-01",
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

  test("a book returned on its deadline day is not reported", async ({ assert }) => {
    await BulkCollectionMonitoring.reportOverdueBooks({
      employee: EMPLOYEE,
      customerItems: [customerItem({ deadline: "2026-09-06" })],
      titles,
      now: NOW,
    });

    assert.isFalse(report.called);
  });
});
