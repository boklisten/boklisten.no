import { useState } from "react";

import { downloadXlsx } from "@/shared/utils/downloadXlsx";
import { showErrorNotification } from "@/shared/utils/notifications";

interface UseReportDownloadOptions {
  fetchRows: () => Promise<unknown[]>;
  /** Ends with .xlsx; the rows are always handed out as an Excel workbook. */
  filename: string;
  errorMessage?: string;
}

export default function useReportDownload({
  fetchRows,
  filename,
  errorMessage = "Klarte ikke laste ned rapport",
}: UseReportDownloadOptions) {
  const [isLoading, setIsLoading] = useState(false);

  async function download() {
    setIsLoading(true);
    try {
      downloadXlsx(filename, await fetchRows());
    } catch {
      showErrorNotification(errorMessage);
    }
    setIsLoading(false);
  }

  return { download, isLoading };
}
