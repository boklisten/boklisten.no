export function normalizeNorwegianPhone(value: unknown): string {
  const digits = String(value ?? "").replaceAll(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("47")) return digits.slice(2);
  if (digits.length === 12 && digits.startsWith("0047")) return digits.slice(4);
  return digits;
}

export function normalizeNorwegianDate(value: unknown): string {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return text;
  return `${match[3]}-${match[2]?.padStart(2, "0")}-${match[1]?.padStart(2, "0")}`;
}
