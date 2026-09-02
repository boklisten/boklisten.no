export type ScanCodeType = "blid" | "isbn" | "customerId" | "unknown";

const BLID_PATTERN = /^[\dA-Za-z]{12}$|^\d{8}$/;
const ISBN_PATTERN = /^\d{13}$/;
/** The customer's user-detail id, shown as a QR code under "Vis kunde-ID". */
const CUSTOMER_ID_PATTERN = /^[\da-f]{24}$/i;

/** The three formats are disjoint in length, so a scanned code classifies without ambiguity. */
export function determineScanCodeType(code: string): ScanCodeType {
  if (BLID_PATTERN.test(code)) {
    return "blid";
  }
  if (ISBN_PATTERN.test(code)) {
    return "isbn";
  }
  if (CUSTOMER_ID_PATTERN.test(code)) {
    return "customerId";
  }
  return "unknown";
}

export function nameScanCodeType(type: ScanCodeType): string {
  switch (type) {
    case "blid": {
      return "bokas unike ID";
    }
    case "isbn": {
      return "bokas ISBN";
    }
    case "customerId": {
      return "kunde-ID";
    }
    default: {
      return "en ukjent kode";
    }
  }
}

export function describeScanCodeFormat(type: ScanCodeType): string {
  switch (type) {
    case "blid": {
      return "8 eller 12 tegn";
    }
    case "isbn": {
      return "13 siffer";
    }
    case "customerId": {
      return "24 tegn";
    }
    default: {
      return "kode";
    }
  }
}

export function listScanCodeTypes(types: ScanCodeType[]): string {
  const names = types.map(nameScanCodeType);
  if (names.length <= 1) {
    return names[0] ?? "en kode";
  }
  return `${names.slice(0, -1).join(", ")} eller ${names.at(-1)}`;
}
