import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Round } from "@/features/matches/rounds/useRounds";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function DeleteMatchesModal({
  round,
  opened,
  onClose,
}: {
  round: Round;
  opened: boolean;
  onClose: () => void;
}) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    api.matchRounds.destroyMatches.mutationOptions({
      onSuccess: () => {
        showSuccessNotification("Overleveringene ble slettet. Runden er planlagt igjen.");
        void queryClient.invalidateQueries({ queryKey: api.matchRounds.index.queryKey() });
        onClose();
      },
      onError: () => showErrorNotification("Klarte ikke slette overleveringene"),
    }),
  );

  return (
    <Modal opened={opened} onClose={onClose} title={"Slett overleveringene"}>
      <Stack>
        <Text>
          Dette sletter {round.matchCount}{" "}
          {round.matchCount === 1 ? "overlevering" : "overleveringer"} i{" "}
          <Text span fw={600}>{`«${round.name}»`}</Text>. Planen beholdes, så du kan generere runden
          på nytt.
        </Text>

        {round.handoverCount > 0 && (
          <Alert
            color={"orange"}
            variant={"light"}
            icon={<IconAlertTriangle size={18} />}
            title={`${round.handoverCount} ${
              round.handoverCount === 1 ? "bok er" : "bøker er"
            } allerede levert i denne runden`}
          >
            Leveringene beholdes i historikken til bøkene, men koblingen til runden forsvinner.
          </Alert>
        )}

        <Text size={"sm"} c={"dimmed"}>
          Elevene mister overleveringene sine, og runden blir skjult for dem til den er generert på
          nytt.
        </Text>

        <Group justify={"flex-end"}>
          <Button variant={"default"} onClick={onClose}>
            Avbryt
          </Button>
          <Button
            color={"red"}
            leftSection={<IconTrash size={16} />}
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate({ params: { id: round.id } })}
          >
            Slett overleveringene
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
