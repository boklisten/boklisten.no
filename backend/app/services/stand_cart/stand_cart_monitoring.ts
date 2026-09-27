import { DateTime } from "luxon";

import type {
  MonitoredAction,
  MonitoredEmployee,
  MonitoringDetail,
} from "#services/employee_monitoring_service";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import type { SignatureExceptionReason } from "#services/signature_helper";
import { HeldBookRules } from "#services/stand_cart/stand_cart_rules";
import { TranslationService } from "#services/translation_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { OrderItem as OrderItemDto } from "#shared/order/order";
import type { Payment } from "#shared/payment/payment";

export interface PlacementReport {
  action: MonitoredAction;
  details: MonitoringDetail[];
}

/** What the reports read of an order line; a stored line and its DTO both have it. */
type OrderItem = Pick<
  OrderItemDto,
  "type" | "handout" | "title" | "blid" | "amount" | "customerItemId"
>;

/** Everything the reports need, read before the order changes any of it. */
export interface PlacementReportInput {
  order: { orderItems: OrderItem[] };
  /** The held books the order acts on, as they were before placement, by customer item id. */
  customerItemsBefore: Map<string, CustomerItem>;
  /** The payments recorded on the order, in whatever way the money moved. */
  payments: Payment[];
  signatureException: SignatureExceptionReason | null;
  now: Date;
}

/** A rent or partly-payment handout: the order items that become customer items. */
export function isLoanHandout(orderItem: Pick<OrderItem, "type" | "handout">): boolean {
  return orderItem.handout && (orderItem.type === "rent" || orderItem.type === "partly-payment");
}

function formatDeadline(deadline: Date | string): string {
  return DateTime.fromJSDate(new Date(deadline)).toFormat("dd.MM.yyyy");
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
    const customerItem = input.customerItemsBefore.get(orderItem.customerItemId ?? "");
    const report = customerItem ? heldBookReport(orderItem, customerItem, input.now) : null;
    return report ? [report] : [];
  });
}

/** Cash never leaves a trace of its own, so every order paid in cash is reported as a whole. */
function cashReports(input: PlacementReportInput): PlacementReport[] {
  return input.payments
    .filter((payment) => payment.method === "cash")
    .map((payment) => ({
      action: "cash-payment-received",
      details: [
        { label: "Beløp", value: `${payment.amount} kr` },
        {
          label: "Bøker",
          value: input.order.orderItems.map((orderItem) => `«${orderItem.title}»`).join(", "),
        },
      ],
    }));
}

function isVippsRefund(payment: Payment): boolean {
  return (
    (payment.method === "vipps-epayment" || payment.method === "vipps-checkout") &&
    payment.amount < 0
  );
}

/**
 * Money sent back through Vipps leaves the till on the employee's word alone, so every order
 * refunded that way is reported as a whole. A refund the administrator transfers by hand is not:
 * the refund request already lands on their desk.
 */
function vippsRefundReports(input: PlacementReportInput): PlacementReport[] {
  const refunded = input.payments
    .filter(isVippsRefund)
    .reduce((sum, payment) => sum - payment.amount, 0);
  if (refunded <= 0) {
    return [];
  }
  return [
    {
      action: "vipps-refund-made",
      details: [
        { label: "Beløp", value: `${refunded} kr` },
        {
          label: "Bøker",
          value: input.order.orderItems
            .map(
              (orderItem) =>
                `«${orderItem.title}»: ${TranslationService.translateOrderItemTypePastTense(orderItem.type)}, ${Math.abs(orderItem.amount)} kr`,
            )
            .join("; "),
        },
      ],
    },
  ];
}

/**
 * Pure: everything the administrator is told about one placed stand order. Held books are judged
 * by the same rules that warned the employee when the line was priced.
 */
export function derivePlacementReports(input: PlacementReportInput): PlacementReport[] {
  return [
    ...signatureReports(input),
    ...heldBookReports(input),
    ...cashReports(input),
    ...vippsRefundReports(input),
  ];
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
