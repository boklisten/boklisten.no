import { determineScanCodeType } from "@/shared/utils/scanCodes";

/** A blid is the book's unique ID: 8 digits or 12 alphanumeric characters. */
export function isValidBlid(value: string): boolean {
  return determineScanCodeType(value) === "blid";
}
