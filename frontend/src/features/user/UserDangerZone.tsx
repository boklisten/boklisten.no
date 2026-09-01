import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Button, Collapse, Group, Paper, Stack, Text, TextInput } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/**
 * GitHub-inspired danger zone for the administrate-user form. Only rendered
 * for admins. Uses an inline confirmation instead of a stacked confirm modal,
 * because ModalsProvider only renders the top modal and would unmount the
 * administrate-user form underneath.
 */
export default function UserDangerZone({
  userDetail,
  onDeleted,
}: {
  userDetail: UserDetail;
  onDeleted?: (() => void) | undefined;
}) {
  const { client } = useApiClient();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmPhrase = userDetail.name || userDetail.email;

  const deleteMutation = useMutation({
    mutationFn: () => client.api.userManagement.destroy({ params: { detailsId: userDetail.id } }),
    onSuccess: () => {
      showSuccessNotification("Kunden ble slettet");
      onDeleted?.();
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke å slette kunden")),
  });

  return (
    <Paper withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-red-6)" }}>
      <Stack gap="xs">
        <Text fw={700} c="red">
          Faresone
        </Text>
        <Text size="sm">
          Sletter kunden permanent. Kunder med aktive bøker, bestillinger eller fakturaer kan ikke
          slettes.
        </Text>
        {!confirming && (
          <Button
            color="red"
            variant="outline"
            leftSection={<IconTrash size={16} />}
            w="fit-content"
            onClick={() => setConfirming(true)}
          >
            Slett kunde
          </Button>
        )}
        <Collapse expanded={confirming}>
          <Stack gap="xs">
            <TextInput
              label={`Skriv «${confirmPhrase}» for å bekrefte slettingen`}
              value={confirmText}
              onChange={(event) => setConfirmText(event.currentTarget.value)}
            />
            <Group gap="xs">
              <Button
                variant="default"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                }}
              >
                Avbryt
              </Button>
              <Button
                color="red"
                leftSection={<IconTrash size={16} />}
                disabled={confirmText.trim() !== confirmPhrase}
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                Slett kunden permanent
              </Button>
            </Group>
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
