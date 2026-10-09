import type { User } from "@boklisten/backend/shared/user";
import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { TuyauHTTPError } from "@tuyau/core/client";

import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { api } from "@/shared/utils/apiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/**
 * How an underage customer gets the agreement signed: the registered guardian is sent a signing
 * link. Shared by the tasks page and the checkout's signing step so the two never drift apart.
 */
export default function GuardianSignatureRequest({ user }: { user: User }) {
  const requestSignatureMutation = useMutation(
    api.signatures.sendLinkMe.mutationOptions({
      onSuccess: () => showSuccessNotification("Signaturforespørsel har blitt sendt!"),
      onError: (error) =>
        showErrorNotification(
          error instanceof TuyauHTTPError && error.status === 429
            ? {
                title: "For mange signaturforespørsler",
                message: "Du kan sende tre forespørsler per døgn. Prøv igjen i morgen.",
              }
            : "Klarte ikke sende signaturforespørsel",
        ),
    }),
  );
  const guardianName = user.guardianName;
  return (
    <Stack>
      <InfoAlert title="Send signaturforespørsel til foresatt">
        <Stack gap={5}>
          <Text>Siden du er under 18 år krever vi signatur fra en av dine foresatte.</Text>
          <Title mt="xs" order={4}>
            Oppgitt foresatt
          </Title>
          <Group gap={5}>
            <Text>Navn:</Text>
            <Text fw="bold">{guardianName}</Text>
          </Group>
          <Group gap={5}>
            <Text>Telefonnummer:</Text>
            <Text fw="bold">{user.guardianPhone}</Text>
          </Group>
          <Group gap={5}>
            <Text>E-post:</Text>
            <Text fw="bold">{user.guardianEmail}</Text>
          </Group>
          <Text fs="italic" size="sm" mt="xs">
            Du kan endre foresatt-opplysninger i brukerinnstillinger
          </Text>
        </Stack>
      </InfoAlert>
      <Button
        leftSection={<IconSend />}
        loading={requestSignatureMutation.isPending}
        onClick={() => requestSignatureMutation.mutate({})}
      >
        Send signeringsforespørsel
        {guardianName && ` til ${guardianName}`}
      </Button>
    </Stack>
  );
}
