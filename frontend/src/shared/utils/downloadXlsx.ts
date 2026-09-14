import { utils, writeFile } from "xlsx";
import type { WorkSheet } from "xlsx";

type Cell = string | number | boolean | Date;

/** Excel refuses sheet names longer than 31 characters or containing []:*?/\ */
function sheetName(filename: string): string {
  const base = filename
    .replace(/\.xlsx$/i, "")
    .replaceAll(/[[\]:*?/\\]/g, " ")
    .trim();
  return base.slice(0, 31) || "Ark1";
}

/** Anything Excel cannot hold as a cell value becomes text; empty values become empty cells. */
function toCell(value: unknown): Cell | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }
  return typeof value === "bigint" ? String(value) : (JSON.stringify(value) ?? "");
}

/** Date cells default to m/d/yy; show them the Norwegian way, with the time when there is one. */
function formatDates(sheet: WorkSheet) {
  for (const cell of Object.values(sheet)) {
    const date: unknown = cell?.v;
    if (date instanceof Date) {
      const isMidnight =
        date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
      // The dots are escaped so spreadsheet libraries do not read "mm." as fractional seconds
      cell.z = isMidnight ? String.raw`dd\.mm\.yyyy` : String.raw`dd\.mm\.yyyy hh:mm`;
    }
  }
}

/**
 * Hands rows to the browser as an Excel workbook with one sheet. The columns are the union of
 * every row's keys, in the order they first appear, so rows with missing fields still line up.
 */
export function downloadXlsx(filename: string, rawRows: readonly unknown[]) {
  const rows = rawRows
    .filter((row): row is object => typeof row === "object" && row !== null)
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).flatMap(([key, value]) => {
          const cell = toCell(value);
          return cell === undefined ? [] : [[key, cell]];
        }),
      ),
    );
  const header = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const sheet = utils.json_to_sheet(rows, { header, cellDates: true });
  formatDates(sheet);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, sheetName(filename));
  writeFile(workbook, filename);
}
