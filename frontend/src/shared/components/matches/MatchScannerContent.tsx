import { Stack, Text } from "@mantine/core";

import { countFulfilled, type ViewerObligation } from "@/features/matches/forViewer";
import type { ItemStatus } from "@/shared/components/matches/matches-helper";
import MatchItemTable, { ItemStatusTable } from "@/shared/components/matches/MatchItemTable";
import ProgressBar from "@/shared/components/ProgressBar";

export default function MatchScannerContent({ obligations }: { obligations: ViewerObligation[] }) {
  const fulfilled = countFulfilled(obligations);
  return (
    <Stack mt={"xs"}>
      <ProgressBar
        percentComplete={obligations.length === 0 ? 100 : (fulfilled * 100) / obligations.length}
        subtitle={
          <Text ta={"center"}>
            {fulfilled} av {obligations.length} bøker mottatt
          </Text>
        }
      />
      <MatchItemTable obligations={obligations} />
    </Stack>
  );
}

export function StandScannerProgress({ itemStatuses }: { itemStatuses: ItemStatus[] }) {
  const fulfilled = itemStatuses.filter((itemStatus) => itemStatus.fulfilled).length;
  return (
    <Stack mt={"xs"}>
      <ProgressBar
        percentComplete={itemStatuses.length === 0 ? 100 : (fulfilled * 100) / itemStatuses.length}
        subtitle={
          <Text ta={"center"}>
            {fulfilled} av {itemStatuses.length} bøker delt ut
          </Text>
        }
      />
      <ItemStatusTable itemStatuses={itemStatuses} isSender={true} />
    </Stack>
  );
}
