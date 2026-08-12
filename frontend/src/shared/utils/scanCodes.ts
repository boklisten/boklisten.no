export type ScanCodeType = "blid" | "isbn" | "unknown";

const BLID_PATTERN = /^[\dA-Za-z]{12}$|^\d{8}$/;
const ISBN_PATTERN = /^\d{13}$/;

export function determineScanCodeType(code: string): ScanCodeType {
  if (BLID_PATTERN.test(code)) {
    return "blid";
  }
  if (ISBN_PATTERN.test(code)) {
    return "isbn";
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
    case "unknown": {
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
    case "unknown": {
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
