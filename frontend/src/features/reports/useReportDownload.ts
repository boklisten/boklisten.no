import { useState } from "react";

import { jsonToCsv } from "@/features/reports/jsonToCsv";
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
      const csv = jsonToCsv(rows);
      const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      showErrorNotification(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return { download, isLoading };
}
