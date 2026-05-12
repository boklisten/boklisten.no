import dayjs from "dayjs";
import { useState } from "react";

import BranchMultiSelect from "@/features/reports/BranchMultiSelect";
import ReportCard from "@/features/reports/ReportCard";
import useReportDownload from "@/features/reports/useReportDownload";
import useApiClient from "@/shared/hooks/useApiClient";

interface UserDetailsReportQuery {
  branchFilter?: string[];
}

export default function UserDetailsReport() {
  const { client } = useApiClient();
  const [branchFilter, setBranchFilter] = useState<string[]>([]);

  const { download, isLoading } = useReportDownload({
    fetchRows: async () => {
      const query: UserDetailsReportQuery = {
        ...(branchFilter.length > 0 && { branchFilter }),
      };
      const rows = await client.api.reports.getUserDetailsReport({ query });
      return (rows ?? []) as Record<string, unknown>[];
    },
    filename: `user_details-${dayjs().format("YYYY-MM-DD")}.csv`,
  });

  return (
    <ReportCard
      title={"Kunder"}
      description={"Eksporter en CSV med alle kunder, filtrert på filialtilhørighet."}
      isLoading={isLoading}
      onDownload={download}
    >
      <BranchMultiSelect
        label={"Filialtilhørighet"}
        value={branchFilter}
        onChange={setBranchFilter}
      />
    </ReportCard>
  );
}
