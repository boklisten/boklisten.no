import type { MonitoredEmployee } from "#services/employee_monitoring_service";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import type { SignatureExceptionReason } from "#services/signature_helper";

/**
 * The monitored actions an employee can commit at the stand while handing out books. Each is
 * reported to the administrator after the handout has gone through, never instead of it.
 */
export const HandoutMonitoring = {
  async reportMissingSignature({
    signatureException,
    employee,
    customerId,
    title,
    blid,
  }: {
    signatureException: SignatureExceptionReason | null;
    employee: MonitoredEmployee;
    customerId: string;
    title: string;
    blid: string;
  }): Promise<void> {
    if (signatureException === null) {
      return;
    }
    await EmployeeMonitoringService.report({
      action: "handout-without-signature",
      employee,
      customerId,
      details: [
        { label: "Bok", value: `«${title}»` },
        { label: "Unik ID", value: blid },
        { label: "Grunn", value: signatureException },
      ],
    });
  },
};
