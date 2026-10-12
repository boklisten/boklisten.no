import { Stack } from "@mantine/core";

import BranchBookMovements from "@/features/branches/insights/BranchBookMovements";
import CustomerCharts from "@/features/user-management/CustomerCharts";
import CustomerStatTiles from "@/features/user-management/CustomerStatTiles";

/**
 * The Innsikt tab of a node: how its members have grown and how active they are, then how the
 * books have moved. All of it is read over the node and the branches below it.
 */
export default function BranchInsightsTab({ branchId }: { branchId: string }) {
  return (
    <Stack gap="lg">
      <CustomerStatTiles branchId={branchId} />
      <CustomerCharts branchId={branchId} />
      <BranchBookMovements branchId={branchId} />
    </Stack>
  );
}
