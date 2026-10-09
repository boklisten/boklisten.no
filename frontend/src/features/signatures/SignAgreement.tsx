import { Button, Skeleton, Spoiler, Stack } from "@mantine/core";
import { IconChecks } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import SignedContractDetails from "@/features/signatures/SignedContractDetails";
import {
  OUTGROWN_SIGNATURE_TITLE,
  describeOutgrownSignature,
} from "@/features/signatures/outgrownSignatureCopy";
import { signaturePrompt } from "@/features/signatures/signaturePrompt";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import EditableTextReadOnly from "@/shared/components/EditableTextReadOnly";
import { useAppForm } from "@/shared/hooks/form";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification } from "@/shared/utils/notifications";
import { authQueryKey } from "@/features/auth/authQuery";
import { api } from "@/shared/utils/apiClient";

/**
 * The loan agreement and its signing form. With a token it serves an emailed signing link, which
 * is how a guardian signs; without one it is the logged-in adult customer signing for themselves.
 */
export default function SignAgreement({ token }: { token?: string }) {
  const queryClient = useQueryClient();
  const linkQuery = useQuery({
    ...api.signatures.linkStatus.queryOptions({ params: { token: token ?? "" } }),
    enabled: token !== undefined,
  });
  const meQuery = useQuery({
    ...api.signatures.agreementMe.queryOptions(),
    enabled: token === undefined,
  });
  const { data, isLoading, isError } = token === undefined ? meQuery : linkQuery;
  const mutationCallbacks = {
    onError: () => showErrorNotification("Noe gikk galt under signering"),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: api.signatures.linkStatus.pathKey() });
      void queryClient.invalidateQueries({ queryKey: api.signatures.agreementMe.pathKey() });
      void queryClient.invalidateQueries({ queryKey: api.signatures.me.pathKey() });
      void queryClient.invalidateQueries({ queryKey: authQueryKey() });
    },
  };
  const signViaLinkMutation = useMutation(
    api.signatures.signViaLink.mutationOptions(mutationCallbacks),
  );
  const signMeMutation = useMutation(api.signatures.signMe.mutationOptions(mutationCallbacks));
  const form = useAppForm({
    defaultValues: {
      signingName: data && "name" in data && !data.isUnderage ? (data.name ?? "") : "",
      base64EncodedImage: "",
    },
    onSubmit: ({ value }) =>
      token === undefined
        ? signMeMutation.mutate({ body: value })
        : signViaLinkMutation.mutate({ params: { token }, body: value }),
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

  if ("invalidLink" in data) {
    return <ErrorAlert title="Ugyldig signeringslenke">{data.message}</ErrorAlert>;
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

  const outgrown = "outgrownGuardianSignature" in data ? data.outgrownGuardianSignature : null;

  return (
    <Stack>
      {outgrown && (
        <InfoAlert title={OUTGROWN_SIGNATURE_TITLE}>
          {describeOutgrownSignature(outgrown)}
        </InfoAlert>
      )}
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
              label={signaturePrompt(data.name ?? "", data.isUnderage ?? false)}
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
          loading={signViaLinkMutation.isPending || signMeMutation.isPending}
          leftSection={<IconChecks />}
          color="green"
        >
          Signer
        </Button>
      </Stack>
    </Stack>
  );
}
