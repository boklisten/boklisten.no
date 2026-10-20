import { downloadBlob } from "@/shared/utils/downloadBlob";

/** Hands a generated text file to the browser as a download. Tabular exports use downloadXlsx instead. */
export function downloadTextFile(filename: string, content: string, type = "text/csv") {
  downloadBlob(filename, new Blob([content], { type: `${type};charset=utf-8` }));
}
