import type { ScanCodeType } from "@/shared/utils/scanCodes";

/** What the Kasse page accepts from any scanner: a customer's QR code or a book's unique ID. */
export const KASSE_CODE_TYPES: ScanCodeType[] = ["customerId", "blid"];
