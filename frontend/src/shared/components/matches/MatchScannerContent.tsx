import { Stack, Text } from "@mantine/core";

import { countFulfilled } from "@/features/matches/forViewer";
import type { ViewerObligation } from "@/features/matches/forViewer";
import MatchItemTable from "@/shared/components/matches/MatchItemTable";
import ProgressBar from "@/shared/components/ProgressBar";

export default function MatchScannerContent({ obligations }: { obligations: ViewerObligation[] }) {
  const fulfilled = countFulfilled(obligations);
  return (
    <Stack mt="xs">
      <ProgressBar
        percentComplete={obligations.length === 0 ? 100 : (fulfilled * 100) / obligations.length}
        subtitle={
          <Text ta="center">
            {fulfilled} av {obligations.length} bøker mottatt
          </Text>
        }
      />
      <MatchItemTable obligations={obligations} />
    </Stack>
  );
}
