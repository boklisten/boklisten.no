import { Group, Loader, Skeleton, Stack, Text } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { use, useEffect } from "react";
import { browser } from "react-dom";

import GuardianSignatureRequest from "@/features/signatures/GuardianSignatureRequest";
import SignAgreement from "@/features/signatures/SignAgreement";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import TanStackButton from "@/shared/components/TanStackButton";
import useApiClient from "@/shared/hooks/useApiClient";
import useCart from "@/shared/hooks/useCart";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { isUnder18 } from "@/shared/utils/dates";

const POLL_INTERVAL_MS = 5000;

/** Shown while the signature status loads, and by the server while the cart is still only in the browser. */
export function CheckoutSignaturePending() {
  return (
    <Stack>
      <Skeleton height={40} />
      <Skeleton height={200} />
      <Skeleton height={50} />
    </Stack>
  );
}

/**
 * The checkout's signing step: reached from `/kasse` when the cart holds books to borrow and the
 * customer has no valid signature. The status is polled so a guardian signing on their own device
 * moves the customer on without a reload; once valid, the checkout resumes at `/kasse`.
 */
export default function CheckoutSignature() {
  use(browser());
  const cart = useCart({ immediately: true });
  const { api } = useApiClient();
  const navigate = useNavigate();

  const { data: userDetail, isError: userDetailFailed } = useQuery(
    api.userDetails.me.queryOptions(),
  );
  const { data: signature, isError: signatureFailed } = useQuery({
    ...api.signatures.me.queryOptions(),
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 0,
  });

  const needsSignature = cart.requiresSignature();
  const cartIsEmpty = cart.isEmpty();
  const isSigned = signature?.isSignatureValid === true;

  useEffect(() => {
    if (cartIsEmpty) {
      void navigate({ to: "/handlekurv", replace: true });
      return;
    }
    if (!needsSignature || isSigned) {
      void navigate({ to: "/kasse", replace: true });
    }
  }, [cartIsEmpty, needsSignature, isSigned, navigate]);

  if (userDetailFailed || signatureFailed) {
    return (
      <ErrorAlert title="Klarte ikke laste signaturstatus">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }
  if (!userDetail || !signature || isSigned || !needsSignature) {
    return <CheckoutSignaturePending />;
  }

  const underage = isUnder18(userDetail.dob);
  return (
    <Stack>
      <Text>Du må signere låneavtalen før du kan fullføre bestillingen.</Text>
      {underage ? (
        <Stack>
          <GuardianSignatureRequest userDetail={userDetail} />
          <Group gap="xs" wrap="nowrap">
            <Loader size="xs" type="dots" />
            <Text size="sm" c="dimmed">
              Du blir videresendt til kassen når foresatt har signert.
            </Text>
          </Group>
        </Stack>
      ) : (
        <SignAgreement userDetailId={userDetail.id} />
      )}
      <TanStackButton
        to="/handlekurv"
        variant="subtle"
        leftSection={<IconArrowLeft />}
        style={{ alignSelf: "flex-start" }}
      >
        Tilbake til handlekurven
      </TanStackButton>
    </Stack>
  );
}
