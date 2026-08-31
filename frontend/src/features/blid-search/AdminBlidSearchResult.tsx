import { Button, Divider, Group, Paper, Skeleton, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import BlidBookHeader from "@/features/blid-search/BlidBookHeader";
import BlidHistoryTimeline from "@/features/blid-search/BlidHistoryTimeline";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import useApiClient from "@/shared/hooks/useApiClient";

export default function AdminBlidSearchResult({
  blid,
  onClear,
}: {
  blid: string;
  onClear: () => void;
}) {
  const { api } = useApiClient();
  const { data, isPending, isError } = useQuery(
    api.blidSearch.lookup.queryOptions({ params: { blid } }),
  );

  if (isPending) {
    return <Skeleton height={280} radius={"md"} />;
  }
  if (isError) {
    return <ErrorAlert>Kunne ikke søke opp boka. Prøv igjen.</ErrorAlert>;
  }

  const unknown = data.book === null && data.history.length === 0;
  if (unknown) {
    return (
      <WarningAlert>
        <Group justify={"space-between"}>
          <Text>Fant ingen bok med unik ID {blid}.</Text>
          <Button variant={"subtle"} size={"compact-sm"} onClick={onClear}>
            Tøm søket
          </Button>
        </Group>
      </WarningAlert>
    );
  }

  return (
    <Paper withBorder radius={"md"} p={"md"}>
      <Stack gap={"md"}>
        <BlidBookHeader result={data} onClear={onClear} />
        <Divider />
        <BlidHistoryTimeline history={data.history} activeItem={data.activeItem} />
      </Stack>
    </Paper>
  );
}
