import { useState } from "react";

import { downloadXlsx } from "@/shared/utils/downloadXlsx";
import { showErrorNotification } from "@/shared/utils/notifications";

interface UseReportDownloadOptions {
  fetchRows: () => Promise<unknown[]>;
  /** Base name in kebab-case; the rows are handed out as `<name>-<timestamp>.xlsx`. */
  name: string;
  errorMessage?: string;
}

export default function useReportDownload({
  fetchRows,
  name,
  errorMessage = "Klarte ikke laste ned rapport",
}: UseReportDownloadOptions) {
  const [isLoading, setIsLoading] = useState(false);

  async function download() {
    setIsLoading(true);
    try {
      downloadXlsx(name, await fetchRows());
    } catch {
      showErrorNotification(errorMessage);
    }
    setIsLoading(false);
  }

  return { download, isLoading };
}
