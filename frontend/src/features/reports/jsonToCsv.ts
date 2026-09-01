function escapeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  let raw: string;
  if (value instanceof Date) {
    raw = value.toISOString();
  } else if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    raw = String(value);
  } else {
    raw = JSON.stringify(value) ?? "";
  }
  return /[",\n\r]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

export function jsonToCsv(rawRows: readonly unknown[]): string {
  const rows = rawRows.filter((row): row is object => typeof row === "object" && row !== null);
  if (rows.length === 0) {
    return "";
  }
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const header = columns.join(",");
  const body = rows
    .map((row) => columns.map((col) => escapeCell(Reflect.get(row, col))).join(","))
    .join("\n");
  return `${header}\n${body}`;
}
