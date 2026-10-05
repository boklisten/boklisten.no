import { DateTime } from "luxon";

/**
 * Every exported file is named `<name>-<local ISO timestamp>.<extension>`, e.g.
 * faktura-visma-2026-10-05T14-30-12.csv: sorts by time, and the time's colons become hyphens
 * because Windows forbids them in filenames. Mirrors the frontend's exportFilename.
 */
export function exportFilename(name: string, extension: string): string {
  return `${name}-${DateTime.now().toFormat("yyyy-MM-dd'T'HH-mm-ss")}.${extension}`;
}
