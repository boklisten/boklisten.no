import * as Sentry from "@sentry/node";
import { DateTime } from "luxon";

import DispatchService from "#services/dispatch_service";
import { StorageService } from "#services/storage_service";
import type { UserDetail } from "#shared/user-detail";
import type { UserPermission } from "#shared/user-permission";
import { USER_PERMISSION } from "#shared/user-permission";
import env from "#start/env";

export const EMPLOYEE_MONITORING_RECIPIENT = "info@boklisten.no";

/**
 * Every out-of-the-ordinary employee action the administrator is told about, with the headline
 * the mail carries. Add an action here and call `report()` from wherever it happens; the
 * frontend shows the matching warning with `MonitoringNotice`.
 */
export const MONITORED_ACTIONS = {
  "handout-without-signature": "Bok delt ut uten gyldig signatur",
  "order-deleted": "Ordre slettet",
} as const;

export type MonitoredAction = keyof typeof MONITORED_ACTIONS;

export interface MonitoringDetail {
  label: string;
  value: string;
}

/** The acting employee as `PermissionService.authenticate()` returns them. */
export interface MonitoredEmployee {
  detailsId: string;
  permission: UserPermission;
}

export interface MonitoringReport {
  action: MonitoredAction;
  employee: UserDetail;
  customer: UserDetail | null;
  details: MonitoringDetail[];
  occurredAt: DateTime;
}

/** Administrators answer to nobody here, so their actions are never reported. */
export function isMonitored(employee: MonitoredEmployee): boolean {
  return employee.permission !== USER_PERMISSION.ADMIN;
}

export function buildMonitoringMail(report: MonitoringReport) {
  const headline = MONITORED_ACTIONS[report.action];
  const occurredAt = report.occurredAt
    .setZone("Europe/Oslo")
    .setLocale("nb")
    .toFormat("d. MMMM yyyy 'kl.' HH:mm");

  const lines = [
    "Ansattvarsel fra Boklisten.no",
    "",
    `Hva: ${headline}`,
    `Tidspunkt: ${occurredAt}`,
    `Ansatt: ${report.employee.name} (${report.employee.email})`,
  ];

  if (report.customer) {
    lines.push(
      "",
      `Kunde: ${report.customer.name}`,
      `Telefon: ${report.customer.phone}`,
      `E-post: ${report.customer.email}`,
      `Kasse: ${env.get("CLIENT_URI")}/admin/kasse?kunde=${report.customer.id}`,
    );
  }

  if (report.details.length > 0) {
    lines.push("", "Detaljer:", ...report.details.map(({ label, value }) => `${label}: ${value}`));
  }

  return {
    to: EMPLOYEE_MONITORING_RECIPIENT,
    subject: `Ansattvarsel: ${headline}`,
    text: lines.join("\n"),
  };
}

async function sendReport({
  action,
  employee,
  customerId,
  details,
}: {
  action: MonitoredAction;
  employee: MonitoredEmployee;
  customerId?: string | null;
  details: MonitoringDetail[];
}): Promise<void> {
  const employeeDetail = await StorageService.UserDetails.get(employee.detailsId);
  const customer = customerId ? await StorageService.UserDetails.get(customerId) : null;
  const mail = buildMonitoringMail({
    action,
    employee: employeeDetail,
    customer,
    details,
    occurredAt: DateTime.now(),
  });
  await DispatchService.sendPlainEmail({
    ...mail,
    context: {
      messageType: "employee-monitoring",
      regardingCustomerDetailsId: customer?.id ?? null,
    },
  });
}

export const EmployeeMonitoringService = {
  /**
   * Tells the administrator that an employee did something that is not normally allowed. Admins
   * are exempt. The action has already happened when this is called, so a report that cannot be
   * sent goes to Sentry instead of failing the request.
   */
  async report(input: {
    action: MonitoredAction;
    employee: MonitoredEmployee;
    customerId?: string | null;
    details: MonitoringDetail[];
  }): Promise<void> {
    if (!isMonitored(input.employee)) {
      return;
    }
    try {
      await sendReport(input);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { monitoredAction: input.action },
        extra: { employeeDetailsId: input.employee.detailsId, customerId: input.customerId },
      });
    }
  },
};
