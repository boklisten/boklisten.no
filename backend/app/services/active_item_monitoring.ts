import { DateTime } from "luxon";

import type { MonitoredEmployee } from "#services/employee_monitoring_service";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";

export const FALLBACK_BRANCH_NAME = "Ukjent filial";

function formatDeadline(deadline: Date): string {
  return DateTime.fromJSDate(deadline).setZone("Europe/Oslo").toFormat("dd.MM.yyyy");
}

/**
 * Corrections to an active loan from Boksøk. Any employee may make them, and everyone below admin
 * is reported to the administrator once the change has been written.
 */
export const ActiveItemMonitoring = {
  async reportDeadlineChange({
    employee,
    customerId,
    title,
    blid,
    previousDeadline,
    deadline,
  }: {
    employee: MonitoredEmployee;
    customerId: string;
    title: string;
    blid: string;
    previousDeadline: Date;
    deadline: Date;
  }): Promise<void> {
    await EmployeeMonitoringService.report({
      action: "active-item-deadline-changed",
      employee,
      customerId,
      details: [
        { label: "Bok", value: `«${title}»` },
        { label: "Unik ID", value: blid },
        { label: "Gammel frist", value: formatDeadline(previousDeadline) },
        { label: "Ny frist", value: formatDeadline(deadline) },
      ],
    });
  },

  async reportBranchChange({
    employee,
    customerId,
    title,
    blid,
    previousBranchName,
    branchName,
  }: {
    employee: MonitoredEmployee;
    customerId: string;
    title: string;
    blid: string;
    previousBranchName: string | null;
    branchName: string;
  }): Promise<void> {
    await EmployeeMonitoringService.report({
      action: "active-item-branch-changed",
      employee,
      customerId,
      details: [
        { label: "Bok", value: `«${title}»` },
        { label: "Unik ID", value: blid },
        { label: "Gammel filial", value: previousBranchName ?? FALLBACK_BRANCH_NAME },
        { label: "Ny filial", value: branchName },
      ],
    });
  },
};
