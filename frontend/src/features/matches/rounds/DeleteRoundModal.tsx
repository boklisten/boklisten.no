import { Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { useRefreshRounds, type Round } from "@/features/matches/rounds/useRounds";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function DeleteRoundModal({
  round,
  opened,
  onClose,
  onDeleted,
}: {
  round: Round;
  opened: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { api } = useApiClient();
  const refreshRounds = useRefreshRounds();
  const [confirmation, setConfirmation] = useState("");

  function close() {
    setConfirmation("");
    onClose();
  }

  const deleteMutation = useMutation(
    api.matchRounds.destroy.mutationOptions({
      onSuccess: () => {
        showSuccessNotification("Runden ble slettet");
        refreshRounds();
        onDeleted();
        close();
      },
      onError: () => showErrorNotification("Klarte ikke slette runden"),
    }),
  );

  return (
    <Modal opened={opened} onClose={close} title={"Slett runden"}>
      <Stack>
        <Text>
          Dette sletter runden <Text span fw={600}>{`«${round.name}»`}</Text> for godt, med alle
          overleveringene i den. Elevene mister overleveringene sine i denne runden, og bøkene låses
          opp igjen.
        </Text>
        <Text size={"sm"} c={"dimmed"}>
          Overleveringer som allerede er fullført beholdes i historikken til bøkene.
        </Text>
        <TextInput
          data-autofocus
          label={`Skriv «${round.name}» for å bekrefte`}
          placeholder={round.name}
          value={confirmation}
          onChange={(event) => setConfirmation(event.currentTarget.value)}
        />
        <Group justify={"flex-end"}>
          <Button variant={"default"} onClick={close}>
            Avbryt
          </Button>
          <Button
            color={"red"}
            leftSection={<IconTrash size={16} />}
            disabled={confirmation.trim() !== round.name}
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate({ params: { id: round.id } })}
          >
            Slett runden
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
