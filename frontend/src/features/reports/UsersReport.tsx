import dayjs from "dayjs";
import { useState } from "react";

import BranchMultiSelect from "@/features/reports/BranchMultiSelect";
import ReportCard from "@/features/reports/ReportCard";
import useReportDownload from "@/features/reports/useReportDownload";
import { apiClient } from "@/shared/utils/apiClient";

interface UsersReportQuery {
  branchFilter?: string[];
}

export default function UsersReport() {
  const [branchFilter, setBranchFilter] = useState<string[]>([]);

  const { download, isLoading } = useReportDownload({
    fetchRows: async () => {
      const query: UsersReportQuery = {
        ...(branchFilter.length > 0 && { branchFilter }),
      };
      const rows = await apiClient.api.reports.users({ query });
      return rows ?? [];
    },
    filename: `kunder-${dayjs().format("YYYY-MM-DD")}.xlsx`,
  });

  return (
    <ReportCard
      title="Kunder"
      description="Eksporter en Excel-fil med alle kunder, filtrert på filialtilhørighet."
      isLoading={isLoading}
      onDownload={download}
    >
      <BranchMultiSelect
        label="Filialtilhørighet"
        value={branchFilter}
        onChange={setBranchFilter}
      />
    </ReportCard>
  );
}
