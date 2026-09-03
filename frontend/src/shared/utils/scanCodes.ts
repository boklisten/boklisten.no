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

/** Where the code is found, shown beside the camera and in a rejection notice. */
export function describeScanCodeLocation(type: ScanCodeType): string | null {
  switch (type) {
    case "blid": {
      return "Klistremerke på baksiden eller på første side i omslaget";
    }
    case "customerId": {
      return "QR-koden under «Vis kunde-ID» på boklisten.no";
    }
    case "isbn": {
      return "Strekkoden med 13 siffer, vanligvis på baksiden av boka";
    }
    default: {
      return null;
    }
  }
}

function scanInsteadHint(accepted: ScanCodeType[]): string {
  const [only] = accepted;
  const location = accepted.length === 1 && only ? describeScanCodeLocation(only) : null;
  const instruction = `Skann ${listScanCodeTypes(accepted)}.`;
  return location ? `${instruction} ${location}.` : instruction;
}

/** The notice for a code that was recognised (or not) but is not one of the accepted types. */
export function describeRejectedScan(
  scanned: ScanCodeType,
  accepted: ScanCodeType[],
): { title: string; message: string } {
  const hint = scanInsteadHint(accepted);
  if (scanned === "unknown") {
    return { title: "Ugyldig strekkode", message: `Denne koden kjenner vi ikke igjen. ${hint}` };
  }
  return { title: "Feil strekkode", message: `Du skannet ${nameScanCodeType(scanned)}. ${hint}` };
}
