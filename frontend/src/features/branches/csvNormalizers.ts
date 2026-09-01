export function cellToString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function normalizeNorwegianPhone(value: unknown): string {
  const digits = cellToString(value).replaceAll(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("47")) {
    return digits.slice(2);
  }
  if (digits.length === 12 && digits.startsWith("0047")) {
    return digits.slice(4);
  }
  return digits;
}

export function normalizeNorwegianDate(value: unknown): string {
  const text = cellToString(value).trim();
  const match = /^(?<day>\d{1,2})\.(?<month>\d{1,2})\.(?<year>\d{4})$/.exec(text);
  if (!match?.groups) {
    return text;
  }
  const { day, month, year } = match.groups;
  return `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}`;
}
