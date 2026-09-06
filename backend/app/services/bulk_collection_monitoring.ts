import { DateTime } from "luxon";

import type { MonitoredEmployee } from "#services/employee_monitoring_service";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import { isDeadlineOverdue } from "#shared/deadline";

/**
 * Innsamling accepts a book after its deadline, but the employee is warned first and everyone
 * below admin is reported to the administrator, one report per overdue book, once the return
 * order has been placed.
 */
export const BulkCollectionMonitoring = {
  async reportOverdueBooks({
    employee,
    customerItems,
    titles,
    now,
  }: {
    employee: MonitoredEmployee;
    customerItems: CustomerItem[];
    /** Book title by item id. */
    titles: Map<string, string>;
    now: Date;
  }): Promise<void> {
    for (const customerItem of customerItems) {
      if (!isDeadlineOverdue(customerItem.deadline, now)) {
        continue;
      }
      await EmployeeMonitoringService.report({
        action: "overdue-book-collected",
        employee,
        customerId: customerItem.customer,
        details: [
          { label: "Bok", value: `«${titles.get(customerItem.item) ?? ""}»` },
          { label: "Unik ID", value: customerItem.blid ?? "" },
          {
            label: "Frist",
            value: DateTime.fromJSDate(new Date(customerItem.deadline))
              .setZone("Europe/Oslo")
              .toFormat("dd.MM.yyyy"),
          },
        ],
      });
    }
  },
};
