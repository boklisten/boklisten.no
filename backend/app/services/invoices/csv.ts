export type CsvCell = string | number | null | undefined;

/**
 * Serialises rows the way bl-admin's invoice exports did, so the files keep working in the
 * Visma and Tripletex imports:
 *
 * - fields are separated by ";" and rows end with "\n"
 * - every row is padded to the widest row, since the old export went through a spreadsheet
 * - a string is quoted only when it contains ";", a quote or a line break
 * - a number is printed with at most 11 significant digits, which removes the floating point
 *   noise from amounts converted to øre (1 736 569.9999999998 prints as 1736570)
 * - a missing value is an empty field
 */
export function toSemicolonCsv(rows: CsvCell[][]): string {
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows
    .map(
      (row) => `${Array.from({ length: width }, (_, index) => formatCell(row[index])).join(";")}\n`,
    )
    .join("");
}

function formatCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) {
    return "";
  }
  if (typeof cell === "number") {
    return Number.isFinite(cell) ? String(Number(cell.toPrecision(11))) : "";
  }
  return /[;"\n\r]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}
