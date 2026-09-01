import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconArrowDown, IconArrowsExchange } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type {
  DuplicatePair,
  DuplicateUserSummary,
} from "@/features/user-management/duplicateTypes";
import MergeRoleCard from "@/features/user-management/MergeRoleCard";
import useBranchNames from "@/features/user-management/useBranchNames";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

function totalActivity(user: DuplicateUserSummary) {
  return user.activeBooks + user.orderedItems + user.activeMatches;
}

export default function MergeCustomersModal({
  pair,
  opened,
  onClose,
}: {
  pair: DuplicatePair;
  opened: boolean;
  onClose: () => void;
}) {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const branchNames = useBranchNames();
  const [first, second] = pair.users;
  // Keep the account that is actually in use unless the admin swaps direction
  const defaultKeepId =
    first && second && totalActivity(first) < totalActivity(second)
      ? second.detailsId
      : first?.detailsId;
  const [keepId, setKeepId] = useState(defaultKeepId);

  const mergeMutation = useMutation({
    mutationFn: (input: { fromDetailsId: string; toDetailsId: string }) =>
      client.api.userManagement.merge({ body: input }),
    onSuccess: async () => {
      showSuccessNotification("Kundene ble slått sammen");
      onClose();
      await queryClient.invalidateQueries({
        queryKey: api.userManagement.duplicates.queryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: api.userManagement.metrics.queryKey(),
      });
    },
    onError: (error) =>
      showErrorNotification(errorMessage(error, "Klarte ikke å slå sammen kundene")),
  });

  if (!first || !second) {
    return null;
  }
  const keptUser = first.detailsId === keepId ? first : second;
  const deletedUser = first.detailsId === keepId ? second : first;

  return (
    <Modal opened={opened} onClose={onClose} title="Slå sammen kunder" size="lg">
      <Stack gap="sm">
        <MergeRoleCard
          user={deletedUser}
          mergeRole="delete"
          branchName={branchNames.get(deletedUser.branchMembership ?? "")}
        />
        <Group justify="space-between">
          <Group gap={6} c="dimmed">
            <IconArrowDown size={18} />
            <Text size="sm">Alt innhold flyttes til</Text>
          </Group>
          <Button
            variant="default"
            size="compact-sm"
            leftSection={<IconArrowsExchange size={16} />}
            onClick={() => setKeepId(deletedUser.detailsId)}
          >
            Bytt retning
          </Button>
        </Group>
        <MergeRoleCard
          user={keptUser}
          mergeRole="keep"
          branchName={branchNames.get(keptUser.branchMembership ?? "")}
        />
        <Alert color="red">
          Kontoen til «{deletedUser.name || deletedUser.email}» slettes permanent. Bøker,
          bestillinger, betalinger og overleveringer flyttes til «{keptUser.name || keptUser.email}
          ». Dette kan ikke angres.
        </Alert>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            color="red"
            loading={mergeMutation.isPending}
            onClick={() =>
              mergeMutation.mutate({
                fromDetailsId: deletedUser.detailsId,
                toDetailsId: keptUser.detailsId,
              })
            }
          >
            Slå sammen kundene
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
