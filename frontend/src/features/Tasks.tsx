import { Button, Group, Skeleton, Stack, Stepper, Text, Title } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity } from "react";

import SignAgreement from "@/features/signatures/SignAgreement";
import UserSettingsForm from "@/features/user/UserSettingsForm";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import CountdownToRedirect from "@/shared/components/CountdownToRedirect";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { isUnder18 } from "@/shared/utils/dates";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function Tasks() {
  const { api } = useApiClient();
  const { data, isLoading, isError } = useQuery(
    api.userDetail.getMyDetails.queryOptions(
      {},
      {
        refetchInterval: 5000,
      },
    ),
  );
  const requestSignatureMutation = useMutation(
    api.signatures.sendSignatureLinkAsCustomer.mutationOptions({
      onSuccess: () => showSuccessNotification("Signaturforespørsel har blitt sendt!"),
      onError: () => showErrorNotification("Klarte ikke sende signaturforespørsel"),
    }),
  );

  if (isLoading) {
    return (
      <Stack>
        <Skeleton height={150} />
        <Skeleton height={150} />
        <Skeleton height={150} />
      </Stack>
    );
  }
  if (!data || isError) {
    return (
      <ErrorAlert title="Noe gikk galt under lasting av dine oppgaver">
        {PLEASE_TRY_AGAIN_TEXT}
      </ErrorAlert>
    );
  }
  const hasTasks = (data.tasks?.confirmDetails || data.tasks?.signAgreement) ?? false;

  if (!hasTasks) {
    return (
      <Stack>
        <SuccessAlert>Du har fullført alle utestående oppgaver</SuccessAlert>
        <CountdownToRedirect shouldRedirectToCaller seconds={5} />
      </Stack>
    );
  }
  const confirmDetailsTask = data?.tasks?.confirmDetails;
  const signAgreementTask = data?.tasks?.signAgreement;
  return (
    <>
      <Text fs="italic">
        Vi mangler noen opplysninger fra deg – fullfør oppgavene nedenfor for å fortsette.
      </Text>
      <Stepper active={0}>
        {confirmDetailsTask && (
          <Stepper.Step label="Bekreft din informasjon">
            <UserSettingsForm userDetail={data} />
          </Stepper.Step>
        )}
        {signAgreementTask && (
          <Stepper.Step label="Signer låneavtale">
            <Activity mode={isUnder18(data.dob) ? "visible" : "hidden"}>
              <Stack>
                <InfoAlert title="Send signaturforespørsel til foresatt">
                  <Stack gap={5}>
                    <Text>
                      Siden du er under 18 år krever vi signatur fra en av dine foresatte.
                    </Text>
                    <Title mt="xs" order={4}>
                      Oppgitt foresatt
                    </Title>
                    <Group gap={5}>
                      <Text>Navn</Text>
                      <Text fw="bold">{data.guardian?.name}</Text>
                    </Group>
                    <Group gap={5}>
                      <Text>Telefonnummer:</Text>
                      <Text fw="bold">{data.guardian?.phone}</Text>
                    </Group>
                    <Group gap={5}>
                      <Text>E-post:</Text>
                      <Text fw="bold">{data.guardian?.email}</Text>
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
                  {data.guardian?.name && ` til ${data.guardian?.name}`}
                </Button>
              </Stack>
            </Activity>
            <Activity mode={!isUnder18(data.dob) ? "visible" : "hidden"}>
              <SignAgreement userDetailId={data.id} />
            </Activity>
          </Stepper.Step>
        )}
      </Stepper>
    </>
  );
}
