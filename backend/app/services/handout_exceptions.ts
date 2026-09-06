import { ExceptionReportService } from "#services/exception_report_service";
import type { SignatureExceptionReason } from "#services/signature_helper";

/**
 * The exceptions an employee can commit at the stand while handing out books. Each is reported to
 * the administrator after the handout has gone through, never instead of it.
 */
export const HandoutExceptions = {
  async reportMissingSignature({
    signatureException,
    employeeId,
    customerId,
    title,
    blid,
  }: {
    signatureException: SignatureExceptionReason | null;
    employeeId: string;
    customerId: string;
    title: string;
    blid: string;
  }): Promise<void> {
    if (signatureException === null) {
      return;
    }
    await ExceptionReportService.report({
      kind: "handout-without-signature",
      employeeId,
      customerId,
      details: [
        { label: "Bok", value: `«${title}»` },
        { label: "Unik ID", value: blid },
        { label: "Grunn", value: signatureException },
      ],
    });
  },
};
