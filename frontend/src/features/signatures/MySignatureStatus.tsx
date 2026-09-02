import { Box, Stack, Text } from "@mantine/core";
import { IconSignature } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import SignedContractDetails from "@/features/signatures/SignedContractDetails";
import TanStackButton from "@/shared/components/TanStackButton";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import useApiClient from "@/shared/hooks/useApiClient";

export default function MySignatureStatus() {
  const { api } = useApiClient();
  const { data: userDetail } = useQuery(api.userDetail.getMyDetails.queryOptions());
  const { data, isLoading, isError } = useQuery(api.signatures.getMySignature.queryOptions());

  if (isLoading || !data || isError) {
    return null;
  }

  if (data.isSignatureValid) {
    return (
      <Box mt="md">
        <SignedContractDetails
          signedByGuardian={data.signedByGuardian ?? false}
          signingName={data.signingName ?? ""}
          name={userDetail?.name ?? ""}
          signedAtText={data.signedAtText ?? ""}
          expiresAtText={data.expiresAtText ?? ""}
        />
      </Box>
    );
  }

  if (!data.signatureRequired) {
    return null;
  }

  const outgrown = data.outgrownGuardianSignature;
  return (
    <WarningAlert
      title={outgrown ? "Du har fylt 18 år og må signere selv" : "Du mangler gyldig signatur"}
      mt="md"
    >
      <Stack align="flex-start" gap="xs">
        {outgrown && (
          <Text>
            {outgrown.signingName} (foresatt) signerte låneavtalen på dine vegne{" "}
            {outgrown.signedAtText}.
          </Text>
        )}
        <Text>Bøker kan ikke deles ut før låneavtalen er signert.</Text>
        <TanStackButton to="/oppgaver" leftSection={<IconSignature />}>
          Signer låneavtale
        </TanStackButton>
      </Stack>
    </WarningAlert>
  );
}
