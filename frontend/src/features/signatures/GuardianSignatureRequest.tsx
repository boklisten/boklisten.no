import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";

import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/**
 * How an underage customer gets the agreement signed: the registered guardian is sent a signing
 * link. Shared by the tasks page and the checkout's signing step so the two never drift apart.
 */
export default function GuardianSignatureRequest({ userDetail }: { userDetail: UserDetail }) {
  const { api } = useApiClient();
  const requestSignatureMutation = useMutation(
    api.signatures.sendLinkMe.mutationOptions({
      onSuccess: () => showSuccessNotification("Signaturforespørsel har blitt sendt!"),
      onError: () => showErrorNotification("Klarte ikke sende signaturforespørsel"),
    }),
  );
  const guardianName = userDetail.guardian?.name;
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
            <Text fw="bold">{userDetail.guardian?.phone}</Text>
          </Group>
          <Group gap={5}>
            <Text>E-post:</Text>
            <Text fw="bold">{userDetail.guardian?.email}</Text>
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
