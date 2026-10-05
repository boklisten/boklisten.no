import dayjs from "dayjs";

/**
 * Every exported file is named `<name>-<local ISO timestamp>.<extension>`, e.g.
 * bestillinger-2026-10-05T14-30-12.xlsx: sorts by time, and the time's colons become hyphens
 * because Windows forbids them in filenames. Call it at download time, not render time, so the
 * stamp is the moment of the export. Mirrors the backend's exportFilename.
 */
export function exportFilename(name: string, extension: string): string {
  return `${name}-${dayjs().format("YYYY-MM-DD[T]HH-mm-ss")}.${extension}`;
}
