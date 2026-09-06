import { useState } from "react";

import { jsonToCsv } from "@/features/reports/jsonToCsv";
import { downloadTextFile } from "@/shared/utils/downloadTextFile";
import { showErrorNotification } from "@/shared/utils/notifications";

interface UseReportDownloadOptions {
  fetchRows: () => Promise<unknown[]>;
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
      const rows = await fetchRows();
      // The BOM makes Excel read the file as UTF-8.
      downloadTextFile(filename, `﻿${jsonToCsv(rows)}`);
    } catch {
      showErrorNotification(errorMessage);
    }
    setIsLoading(false);
  }

  return { download, isLoading };
}
