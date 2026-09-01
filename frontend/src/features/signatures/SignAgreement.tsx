import { Button, Skeleton, Spoiler, Stack } from "@mantine/core";
import { IconChecks } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import SignedContractDetails from "@/features/signatures/SignedContractDetails";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import EditableTextReadOnly from "@/shared/components/EditableTextReadOnly";
import { useAppForm } from "@/shared/hooks/form";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification } from "@/shared/utils/notifications";
import { publicApi } from "@/shared/utils/publicApiClient";

export default function SignAgreement({ userDetailId }: { userDetailId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery(
    publicApi.signatures.hasValidSignature.queryOptions({ params: { detailsId: userDetailId } }),
  );
  const signMutation = useMutation(
    publicApi.signatures.sign.mutationOptions({
      onError: () => showErrorNotification("Noe gikk galt under signering"),
      onSettled: () => {
        void queryClient.invalidateQueries({
          queryKey: publicApi.signatures.hasValidSignature.queryKey({
            params: { detailsId: userDetailId },
          }),
        });
        void queryClient.invalidateQueries({
          queryKey: publicApi.signatures.getMySignature.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: publicApi.userDetail.getMyDetails.pathKey(),
        });
      },
    }),
  );
  const form = useAppForm({
    defaultValues: {
      signingName: data && !data.isUnderage && "name" in data ? (data.name ?? "") : "",
      base64EncodedImage: "",
    },
    onSubmit: ({ value }) =>
      signMutation.mutate({ params: { detailsId: userDetailId }, body: value }),
  });

  if (isLoading) {
    return (
      <Stack>
        <Skeleton height={40} width="100%" />
        <Skeleton height={200} width="100%" />
        <Skeleton height={50} width="100%" />
        <Skeleton height={50} width={100} />
      </Stack>
    );
  }

  if (isError || !data) {
    return (
      <ErrorAlert title="Noe gikk galt under lasting av signaturstatus">
        {PLEASE_TRY_AGAIN_TEXT}
      </ErrorAlert>
    );
  }

  if (data.isSignatureValid) {
    return (
      <Stack>
        <Spoiler maxHeight={165} showLabel="Vis mer" hideLabel="Vis mindre">
          <EditableTextReadOnly dataKey="betingelser" />
        </Spoiler>
        <SignedContractDetails
          signedByGuardian={data.signedByGuardian ?? false}
          signingName={data.signingName ?? ""}
          name={data.name ?? ""}
          signedAtText={data.signedAtText ?? ""}
          expiresAtText={data.expiresAtText ?? ""}
        />
      </Stack>
    );
  }

  return (
    <Stack>
      <Spoiler maxHeight={165} showLabel="Vis mer" hideLabel="Vis mindre">
        <EditableTextReadOnly dataKey="betingelser" />
      </Spoiler>
      <Stack gap="xs">
        <form.AppField
          name="base64EncodedImage"
          validators={{
            onSubmit: ({ value }) =>
              value.length === 0
                ? `Du må fylle inn ${data.isUnderage ? "foresatt sin" : "din"} signatur`
                : null,
          }}
        >
          {(field) => (
            <field.SignatureCanvasField
              label={`Signer her på at du er${data.isUnderage ? " foresatt til" : ""} ${data.name} og godkjenner betingelsene${data.isUnderage ? " på hans eller hennes vegne" : ""}:`}
            />
          )}
        </form.AppField>
        <form.AppField
          name="signingName"
          validators={{
            onChange: ({ value }) => {
              if (value?.length === 0) {
                return "Du må fylle inn foresatt sitt fulle navn";
              }
              if (data.isUnderage && data.name === value) {
                return "Foresattes navn må være forskjellig fra elevens navn";
              }
              return null;
            },
          }}
        >
          {(field) => (
            <field.TextField
              required
              label={`Fullt navn ${data.isUnderage ? "(foresatt)" : ""}`}
              description={data.isUnderage ? "" : "Du kan endre navnet ditt i brukerinnstillinger"}
              readOnly={!data.isUnderage}
            />
          )}
        </form.AppField>
        <Button
          onClick={form.handleSubmit}
          loading={signMutation.isPending}
          leftSection={<IconChecks />}
          color="green"
        >
          Signer
        </Button>
      </Stack>
    </Stack>
  );
}
