import { Button, Divider, Group, Paper, Skeleton, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import BlidBookHeader from "@/features/blid-search/BlidBookHeader";
import BlidHistoryTimeline from "@/features/blid-search/BlidHistoryTimeline";
import BlidLabelModal from "@/features/blid-search/BlidLabelModal";
import EditBlidModal from "@/features/blid-search/EditBlidModal";
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
  const [editing, setEditing] = useState(false);
  const [showingLabel, setShowingLabel] = useState(false);

  if (isPending) {
    return <Skeleton height={280} radius="md" />;
  }
  if (isError) {
    return <ErrorAlert>Kunne ikke søke opp boka. Prøv igjen.</ErrorAlert>;
  }

  const unknown = data.book === null && data.history.length === 0;
  if (unknown) {
    return (
      <WarningAlert>
        <Group justify="space-between">
          <Text>Fant ingen bok med unik ID {blid}.</Text>
          <Button variant="subtle" size="compact-sm" onClick={onClear}>
            Tøm søket
          </Button>
        </Group>
      </WarningAlert>
    );
  }

  return (
    <Stack gap={6}>
      <Text fz="sm" fw={500} c="dimmed">
        Valgt bok
      </Text>
      <Paper withBorder radius="md" p="md">
        <Stack gap="md">
          <BlidBookHeader
            result={data}
            // A blid known only from old customer items has no unique item to edit or delete.
            onEdit={data.registered ? () => setEditing(true) : undefined}
            onClear={onClear}
            onShowLabel={() => setShowingLabel(true)}
          />
          <Divider />
          <BlidHistoryTimeline history={data.history} activeItem={data.activeItem} />
        </Stack>
      </Paper>
      <BlidLabelModal blid={blid} opened={showingLabel} onClose={() => setShowingLabel(false)} />
      {editing && (
        <EditBlidModal
          result={data}
          onClose={() => setEditing(false)}
          onDeleted={() => {
            setEditing(false);
            onClear();
          }}
        />
      )}
    </Stack>
  );
}
