import dayjs from "dayjs";
import { useState } from "react";

import BranchMultiSelect from "@/features/reports/BranchMultiSelect";
import DateRangePresetField from "@/features/reports/DateRangePresetField";
import ReportCard from "@/features/reports/ReportCard";
import useReportDownload from "@/features/reports/useReportDownload";
import {
  DEFAULT_DATE_RANGE,
  resolveDateRange,
  type DateRangeValue,
} from "@/features/reports/dateRangePresets";
import useApiClient from "@/shared/hooks/useApiClient";

interface CustomerItemsReportQuery {
  branchFilter?: string[];
  createdAfter?: string;
  createdBefore?: string;
  deadlineAfter?: string;
  deadlineBefore?: string;
}

export default function CustomerItemsReport() {
  const { client } = useApiClient();

  const [branchFilter, setBranchFilter] = useState<string[]>([]);
  const [creationRange, setCreationRange] = useState<DateRangeValue>(DEFAULT_DATE_RANGE);
  const [deadlineRange, setDeadlineRange] = useState<DateRangeValue>(DEFAULT_DATE_RANGE);

  const { download, isLoading } = useReportDownload({
    fetchRows: async () => {
      const created = resolveDateRange(creationRange);
      const deadline = resolveDateRange(deadlineRange);
      const query: CustomerItemsReportQuery = {
        ...(branchFilter.length > 0 && { branchFilter }),
        ...(created.from && { createdAfter: created.from.toISOString() }),
        ...(created.to && { createdBefore: created.to.toISOString() }),
        ...(deadline.from && { deadlineAfter: deadline.from.toISOString() }),
        ...(deadline.to && { deadlineBefore: deadline.to.toISOString() }),
      };
      const rows = await client.api.reports.getCustomerItemsReport({ query });
      return (rows ?? []) as Record<string, unknown>[];
    },
    filename: `customer_items-${dayjs().format("YYYY-MM-DD")}.csv`,
  });

  return (
    <ReportCard
      title={"Kunders bøker"}
      description={"Eksporter en CSV med alle kunders bøker, filtrert på filial og tid."}
      isLoading={isLoading}
      onDownload={download}
    >
      <BranchMultiSelect value={branchFilter} onChange={setBranchFilter} />
      <DateRangePresetField label={"Opprettet"} value={creationRange} onChange={setCreationRange} />
      <DateRangePresetField label={"Frist"} value={deadlineRange} onChange={setDeadlineRange} />
    </ReportCard>
  );
}
