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

interface OrdersReportQuery {
  branchFilter?: string[];
  createdAfter?: string;
  createdBefore?: string;
}

export default function OrdersReport() {
  const { client } = useApiClient();
  const [branchFilter, setBranchFilter] = useState<string[]>([]);
  const [creationRange, setCreationRange] = useState<DateRangeValue>(DEFAULT_DATE_RANGE);

  const { download, isLoading } = useReportDownload({
    fetchRows: async () => {
      const created = resolveDateRange(creationRange);
      const query: OrdersReportQuery = {
        ...(branchFilter.length > 0 && { branchFilter }),
        ...(created.from && { createdAfter: created.from.toISOString() }),
        ...(created.to && { createdBefore: created.to.toISOString() }),
      };
      const rows = await client.api.reports.getOrdersReport({ query });
      return (rows ?? []) as Record<string, unknown>[];
    },
    filename: `orders-${dayjs().format("YYYY-MM-DD")}.csv`,
  });

  return (
    <ReportCard
      title={"Ordrer"}
      description={"Eksporter en CSV med alle plasserte ordrer, filtrert på filial og tid."}
      isLoading={isLoading}
      onDownload={download}
    >
      <BranchMultiSelect value={branchFilter} onChange={setBranchFilter} />
      <DateRangePresetField label={"Opprettet"} value={creationRange} onChange={setCreationRange} />
    </ReportCard>
  );
}
