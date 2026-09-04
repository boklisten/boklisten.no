import { DateTime } from "luxon";

import DispatchService from "#services/dispatch_service";
import { StorageService } from "#services/storage_service";
import type { UserDetail } from "#shared/user-detail";
import env from "#start/env";

export const EXCEPTION_REPORT_RECIPIENT = "info@boklisten.no";

/**
 * Every kind of out-of-the-ordinary employee action the administrator is told about, with the
 * headline the mail carries. Add a kind here and call `report()` from wherever the action happens.
 */
export const EXCEPTION_KINDS = {
  "handout-without-signature": "Bok delt ut uten gyldig signatur",
} as const;

export type ExceptionKind = keyof typeof EXCEPTION_KINDS;

export interface ExceptionDetail {
  label: string;
  value: string;
}

export interface ExceptionReport {
  kind: ExceptionKind;
  employee: UserDetail;
  customer: UserDetail | null;
  details: ExceptionDetail[];
  occurredAt: DateTime;
}

export function buildExceptionReportMail(report: ExceptionReport) {
  const headline = EXCEPTION_KINDS[report.kind];
  const occurredAt = report.occurredAt
    .setZone("Europe/Oslo")
    .setLocale("nb")
    .toFormat("d. MMMM yyyy 'kl.' HH:mm");

  const lines = [
    "Unntaksmelding fra Boklisten.no",
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
    to: EXCEPTION_REPORT_RECIPIENT,
    subject: `Unntaksmelding: ${headline}`,
    text: lines.join("\n"),
  };
}

export const ExceptionReportService = {
  /** Tells the administrator that an employee did something that is not normally allowed. */
  async report({
    kind,
    employeeId,
    customerId,
    details,
  }: {
    kind: ExceptionKind;
    employeeId: string;
    customerId?: string | null;
    details: ExceptionDetail[];
  }): Promise<void> {
    const employee = await StorageService.UserDetails.get(employeeId);
    const customer = customerId ? await StorageService.UserDetails.get(customerId) : null;
    const mail = buildExceptionReportMail({
      kind,
      employee,
      customer,
      details,
      occurredAt: DateTime.now(),
    });
    await DispatchService.sendPlainEmail({
      ...mail,
      context: {
        messageType: "exception-report",
        regardingCustomerDetailsId: customer?.id ?? null,
      },
    });
  },
};
