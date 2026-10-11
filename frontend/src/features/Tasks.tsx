import { Button, Skeleton, Stack, Stepper, Text } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Activity, useEffect, useEffectEvent, useRef } from "react";

import GuardianSignatureRequest from "@/features/signatures/GuardianSignatureRequest";
import SignAgreement from "@/features/signatures/SignAgreement";
import UserSettingsForm from "@/features/user/UserSettingsForm";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import useLoginRedirect from "@/shared/hooks/useLoginRedirect";
import useRootBranchId from "@/shared/hooks/useRootBranchId";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { isUnder18 } from "@/shared/utils/dates";
import { hasPendingTasks } from "@/shared/utils/tasks";
import { authQueryOptions } from "@/features/auth/authQuery";

export default function Tasks() {
  const { data, isLoading, isError } = useQuery({
    ...authQueryOptions(),
    refetchInterval: 5000,
  });
  // The details form decides what to ask for by the root, "no school", so it waits for it.
  const branches = useRootBranchId();
  const needsBranches = data?.taskConfirmDetails === true;
  const rootBranchId = branches.rootBranchId;

  if (isLoading || (needsBranches && !branches.isError && rootBranchId === undefined)) {
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
  if (needsBranches && branches.isError) {
    return (
      <ErrorAlert title="Klarte ikke hente skolene">
        <Stack gap="xs" align="flex-start">
          Oppgavene trenger listen over skoler. Prøv igjen om et øyeblikk.
          <Button
            variant="light"
            size="compact-sm"
            leftSection={<IconRefresh />}
            onClick={branches.retry}
          >
            Prøv igjen
          </Button>
        </Stack>
      </ErrorAlert>
    );
  }
  if (!hasPendingTasks(data)) {
    return <TasksDone />;
  }
  return (
    <>
      <Text fs="italic">
        Vi mangler noen opplysninger fra deg – fullfør oppgavene nedenfor for å fortsette.
      </Text>
      <Stepper active={0}>
        {data.taskConfirmDetails && rootBranchId !== undefined && (
          <Stepper.Step label="Bekreft din informasjon">
            <UserSettingsForm user={data} confirmDetails={{ rootBranchId }} />
          </Stepper.Step>
        )}
        {data.taskSignAgreement && (
          <Stepper.Step label="Signer låneavtale">
            <Activity mode={isUnder18(data.dob) ? "visible" : "hidden"}>
              <GuardianSignatureRequest user={data} />
            </Activity>
            <Activity mode={!isUnder18(data.dob) ? "visible" : "hidden"}>
              <SignAgreement />
            </Activity>
          </Stepper.Step>
        )}
      </Stepper>
    </>
  );
}

/**
 * Nothing left to do: on to where the customer was heading (the checkout, typically) at once. Once
 * only, since AuthGuard's `Activity` re-runs effects whenever it reveals the page again.
 */
function TasksDone() {
  const { redirectToTarget } = useLoginRedirect();
  const redirected = useRef(false);
  const onDone = useEffectEvent(() => {
    if (!redirected.current) {
      redirected.current = true;
      redirectToTarget();
    }
  });
  useEffect(() => onDone(), []);
  return <SuccessAlert>Du har fullført alle utestående oppgaver</SuccessAlert>;
}
