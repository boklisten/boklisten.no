import type { User } from "@boklisten/backend/shared/user";
import { Button, Group, Paper, Skeleton, Stack, Text } from "@mantine/core";
import { IconCopy, IconSend } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";

import SignedSignatureDetails from "@/features/signatures/SignedSignatureDetails";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import { api } from "@/shared/utils/apiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function AdministrateUserSignatures({ user }: { user: User }) {
  const { data, isLoading, isError } = useQuery(
    api.signatures.show.queryOptions({ params: { userId: user.id } }),
  );
  const linkMutation = useMutation(api.signatures.link.mutationOptions());
  const requestSignatureMutation = useMutation(
    api.signatures.sendLink.mutationOptions({
      onSuccess: () => showSuccessNotification("Signaturforespørsel har blitt sendt!"),
      onError: () => showErrorNotification("Klarte ikke sende signaturforespørsel"),
    }),
  );
  if (isLoading) {
    return <Skeleton />;
  }
  if (!data || isError) {
    return <ErrorAlert title="Klarte ikke laste signatur">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }

  if (data.isSignatureValid) {
    return <SignedSignatureDetails signature={data} name={user.name} />;
  }

  const signingLinkActions = (
    <Group>
      <Button
        leftSection={<IconCopy />}
        loading={linkMutation.isPending}
        onClick={() => {
          // The link is fetched first (the customer's live one, or a fresh one); handing the
          // clipboard a promise keeps the click's permission across the request in Safari.
          const text = linkMutation
            .mutateAsync({ params: { userId: user.id } })
            .then(({ url }) => new Blob([url], { type: "text/plain" }));
          navigator.clipboard
            .write([new ClipboardItem({ "text/plain": text })])
            .then(() => showSuccessNotification("Signeringslenke ble kopiert!"))
            .catch(() => showErrorNotification("Klarte ikke kopiere signeringslenken"));
        }}
      >
        Kopier signeringslenke
      </Button>
      <Button
        leftSection={<IconSend />}
        loading={requestSignatureMutation.isPending}
        onClick={() => requestSignatureMutation.mutate({ params: { userId: user.id } })}
      >
        Send signeringslenke
      </Button>
    </Group>
  );

  const outgrown = data.outgrownGuardianSignature;
  if (outgrown) {
    return (
      <Stack align="center">
        {/* Ink is drawn for paper, so the frame stays white in dark mode too */}
        <Paper withBorder radius="xs" p={1} bg="white">
          <Image
            src={`data:image/webp;base64,${outgrown.image}`}
            alt="Foresatt sin signatur"
            width={300}
            height={100}
          />
        </Paper>
        <WarningAlert title="Foresatt sin signatur gjelder ikke lenger">
          <Stack gap="xs">
            <Text>
              {outgrown.signingName} (foresatt) signerte kontrakten på vegne av {user.name}{" "}
              {outgrown.signedAtText}. {user.name} har fylt 18 år og må signere selv.
            </Text>
            {signingLinkActions}
          </Stack>
        </WarningAlert>
      </Stack>
    );
  }

  return (
    <Stack align="center">
      <WarningAlert title="Denne kunden har ikke gyldig signatur">
        {signingLinkActions}
      </WarningAlert>
    </Stack>
  );
}
