import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Box, Button, CopyButton, Group, Skeleton, Stack } from "@mantine/core";
import { IconCopy, IconSend } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";

import SignedContractDetails from "@/features/signatures/SignedContractDetails";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function AdministrateUserSignatures({ userDetail }: { userDetail: UserDetail }) {
  const { api } = useApiClient();
  const { data, isLoading, isError } = useQuery(
    api.signatures.getSignature.queryOptions({ params: { detailsId: userDetail.id } }),
  );
  const requestSignatureMutation = useMutation(
    api.signatures.sendSignatureLink.mutationOptions({
      onSuccess: () => showSuccessNotification("Signaturforespørsel har blitt sendt!"),
      onError: () => showErrorNotification("Klarte ikke sende signaturforespørsel"),
    }),
  );
  if (isLoading) {
    return <Skeleton />;
  }
  if (!data || isError) {
    return <ErrorAlert title={"Klarte ikke laste signatur"}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }

  if (data.isSignatureValid) {
    return (
      <Stack align="center">
        <Box style={{ border: "1px solid #ccc", borderRadius: 2, p: 1 }}>
          <Image
            src={`data:image/webp;base64,${data.image}`}
            alt="Kundens signatur"
            width={300}
            height={100}
          />
        </Box>
        <SignedContractDetails
          signedByGuardian={data.signedByGuardian ?? false}
          signingName={data.signingName ?? ""}
          name={userDetail.name}
          signedAtText={data.signedAtText ?? ""}
          expiresAtText={data.expiresAtText ?? ""}
        />
      </Stack>
    );
  }

  return (
    <Stack align="center">
      <WarningAlert title={"Denne kunden har ikke gyldig signatur"}>
        <Group>
          <CopyButton value={`${window.location.origin}/signering/${userDetail.id}`}>
            {({ copy }) => (
              <Button
                leftSection={<IconCopy />}
                onClick={() => {
                  copy();
                  showSuccessNotification("Signeringslenke ble kopiert!");
                }}
              >
                Kopier signeringslenke
              </Button>
            )}
          </CopyButton>
          <Button
            leftSection={<IconSend />}
            loading={requestSignatureMutation.isPending}
            onClick={() =>
              requestSignatureMutation.mutate({ params: { detailsId: userDetail.id } })
            }
          >
            Send signeringslenke
          </Button>
        </Group>
      </WarningAlert>
    </Stack>
  );
}
