import { DateTime } from "luxon";

import type {
  MonitoredAction,
  MonitoredEmployee,
  MonitoringDetail,
} from "#services/employee_monitoring_service";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import type { SignatureExceptionReason } from "#services/signature_helper";
import { HeldBookRules } from "#services/stand_cart/stand_cart_rules";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";

export interface PlacementReport {
  action: MonitoredAction;
  details: MonitoringDetail[];
}

/** Everything the reports need, read before the order changes any of it. */
export interface PlacementReportInput {
  order: Order;
  /** The held books the order acts on, as they were before placement, by customer item id. */
  customerItemsBefore: Map<string, CustomerItem>;
  signatureException: SignatureExceptionReason | null;
  now: Date;
}

/** A rent or partly-payment handout: the order items that become customer items. */
export function isLoanHandout(orderItem: OrderItem): boolean {
  return orderItem.handout && (orderItem.type === "rent" || orderItem.type === "partly-payment");
}

/** The held book an order item acts on; an extension keeps the id in its period info. */
export function customerItemIdOf(orderItem: OrderItem): string | undefined {
  return orderItem.customerItem ?? orderItem.info?.customerItem;
}

function formatDeadline(deadline: Date | string): string {
  return DateTime.fromJSDate(new Date(deadline)).setZone("Europe/Oslo").toFormat("dd.MM.yyyy");
}

function bookDetails(orderItem: OrderItem): MonitoringDetail[] {
  return [
    { label: "Bok", value: `«${orderItem.title}»` },
    { label: "Unik ID", value: orderItem.blid ?? "" },
  ];
}

function signatureReports(input: PlacementReportInput): PlacementReport[] {
  if (input.signatureException === null) {
    return [];
  }
  return input.order.orderItems.filter(isLoanHandout).map((orderItem) => ({
    action: "handout-without-signature",
    details: [...bookDetails(orderItem), { label: "Grunn", value: input.signatureException ?? "" }],
  }));
}

/** What a return, cancel or buyout of a held book is reported as, if it is outside the rules. */
function heldBookReport(
  orderItem: OrderItem,
  customerItem: CustomerItem,
  now: Date,
): PlacementReport | null {
  switch (orderItem.type) {
    case "return":
    case "buyback": {
      return HeldBookRules.takeBack(customerItem, now) === null
        ? null
        : {
            action: "overdue-book-collected",
            details: [
              ...bookDetails(orderItem),
              { label: "Frist", value: formatDeadline(customerItem.deadline) },
            ],
          };
    }
    case "cancel":
    case "buyout": {
      const reason =
        orderItem.type === "cancel"
          ? HeldBookRules.cancel(customerItem, DateTime.fromJSDate(now))
          : HeldBookRules.buyout(customerItem, DateTime.fromJSDate(now));
      return reason === null
        ? null
        : {
            action: "active-item-action-outside-rules",
            details: [
              ...bookDetails(orderItem),
              { label: "Handling", value: orderItem.type === "cancel" ? "Kansellert" : "Kjøpt ut" },
              { label: "Grunn", value: reason },
            ],
          };
    }
    default: {
      return null;
    }
  }
}

function heldBookReports(input: PlacementReportInput): PlacementReport[] {
  return input.order.orderItems.flatMap((orderItem) => {
    const customerItem = input.customerItemsBefore.get(customerItemIdOf(orderItem) ?? "");
    const report = customerItem ? heldBookReport(orderItem, customerItem, input.now) : null;
    return report ? [report] : [];
  });
}

/**
 * Pure: everything the administrator is told about one placed stand order. Held books are judged
 * by the same rules that warned the employee when the line was priced.
 */
export function derivePlacementReports(input: PlacementReportInput): PlacementReport[] {
  return [...signatureReports(input), ...heldBookReports(input)];
}

export const StandCartMonitoring = {
  async send(
    reports: PlacementReport[],
    employee: MonitoredEmployee,
    customerId: string,
  ): Promise<void> {
    for (const report of reports) {
      await EmployeeMonitoringService.report({ ...report, employee, customerId });
    }
  },
};
