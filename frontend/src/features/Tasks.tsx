import { Skeleton, Stack, Stepper, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "react";

import GuardianSignatureRequest from "@/features/signatures/GuardianSignatureRequest";
import SignAgreement from "@/features/signatures/SignAgreement";
import UserSettingsForm from "@/features/user/UserSettingsForm";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import CountdownToRedirect from "@/shared/components/CountdownToRedirect";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { isUnder18 } from "@/shared/utils/dates";

export default function Tasks() {
  const { api } = useApiClient();
  const { data, isLoading, isError } = useQuery({
    ...api.userDetails.me.queryOptions(),
    refetchInterval: 5000,
  });

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
  const hasTasks = (data.tasks?.confirmDetails ?? false) || (data.tasks?.signAgreement ?? false);

  if (!hasTasks) {
    return (
      <Stack>
        <SuccessAlert>Du har fullført alle utestående oppgaver</SuccessAlert>
        <CountdownToRedirect shouldRedirectToLoginTarget seconds={5} />
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
              <GuardianSignatureRequest userDetail={data} />
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
