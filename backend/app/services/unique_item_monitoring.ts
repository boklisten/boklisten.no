import type { MonitoredEmployee } from "#services/employee_monitoring_service";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";

/**
 * Edits to a unique item (a blid) from Boksøk. Any employee may make them, and everyone below
 * admin is reported to the administrator once the change has been written.
 */
export const UniqueItemMonitoring = {
  async reportRelink({
    employee,
    customerId,
    blid,
    previousTitle,
    title,
    customerItemCount,
  }: {
    employee: MonitoredEmployee;
    /** The customer currently holding the book, when there is one. */
    customerId: string | null;
    blid: string;
    previousTitle: string;
    title: string;
    customerItemCount: number;
  }): Promise<void> {
    await EmployeeMonitoringService.report({
      action: "unique-item-relinked",
      employee,
      customerId,
      details: [
        { label: "Unik ID", value: blid },
        { label: "Gammel bok", value: `«${previousTitle}»` },
        { label: "Ny bok", value: `«${title}»` },
        { label: "Oppdaterte kundebøker", value: String(customerItemCount) },
      ],
    });
  },

  async reportDelete({
    employee,
    blid,
    title,
  }: {
    employee: MonitoredEmployee;
    blid: string;
    title: string;
  }): Promise<void> {
    await EmployeeMonitoringService.report({
      action: "unique-item-deleted",
      employee,
      customerId: null,
      details: [
        { label: "Unik ID", value: blid },
        { label: "Bok", value: `«${title}»` },
      ],
    });
  },
};
