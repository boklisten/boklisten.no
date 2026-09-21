import type { User } from "@boklisten/backend/shared/user";
import { Collapse, Stack } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

import AdministrateUserSignatures from "@/features/signatures/AdministrateUserSignatures";
import SignatureStatusCard from "@/features/signatures/SignatureStatusCard";
import type { SignatureStatusTone } from "@/features/signatures/SignatureStatusCard";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { api } from "@/shared/utils/apiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

const POLL_INTERVAL_MS = 5000;

/**
 * Whether the customer's contract is signed, as a card that leads to the signature itself. On
 * the Kasse card the details open in a modal, and a valid signature is left out on a phone since
 * it asks nothing of the employee. In the customer's settings (`inForm`) the card always shows and
 * the details unfold under it: a second modal would unmount the form and drop unsaved edits.
 */
export default function SignatureStatusBanner({
  userDetail,
  inForm = false,
}: {
  userDetail: User;
  inForm?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data, isPending, isError } = useQuery(
    api.signatures.show.queryOptions(
      { params: { detailsId: userDetail.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );

  if (isPending) {
    return null;
  }
  if (!data || isError) {
    return (
      <ErrorAlert title="Klarte ikke laste signaturstatus">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }

  const openDetails = () => {
    if (inForm) {
      setExpanded((open) => !open);
      return;
    }
    modals.open({
      title: "Signatur",
      children: <AdministrateUserSignatures userDetail={userDetail} />,
    });
  };

  const card = (
    tone: SignatureStatusTone,
    title: string,
    description: ReactNode,
    ariaLabel: string,
  ) => (
    <SignatureStatusCard
      tone={tone}
      title={title}
      description={description}
      ariaLabel={ariaLabel}
      expanded={inForm ? expanded : undefined}
      onClick={openDetails}
    />
  );

  const withDetails = (content: ReactNode, hideOnPhone = false) => (
    <Stack gap="xs" visibleFrom={hideOnPhone ? "sm" : undefined}>
      {content}
      {inForm && (
        <Collapse expanded={expanded}>
          <AdministrateUserSignatures userDetail={userDetail} />
        </Collapse>
      )}
    </Stack>
  );

  if (data.isSignatureValid) {
    return withDetails(
      card(
        "valid",
        "Gyldig signatur",
        <>
          {/* Non-breaking spaces keep the dot with the first half and the date with
              "gyldig til", so a narrow card wraps into two tidy lines. */}
          Signert av {data.signedByGuardian ? "foresatt" : "kunden selv"}
          {"\u00A0· gyldig\u00A0til\u00A0"}
          {data.expiresAtText}
        </>,
        "Gyldig signatur – se signatur",
      ),
      !inForm,
    );
  }

  if (!data.signatureRequired) {
    return null;
  }

  if (data.outgrownGuardianSignature) {
    return withDetails(
      card(
        "warning",
        "Signert av foresatt, må signeres på nytt",
        "Kunden har fylt 18 år og må signere selv før bøker kan deles ut. Trykk her for å ordne signaturen.",
        "Signert av foresatt, må signeres på nytt – ordne signatur",
      ),
    );
  }

  return withDetails(
    card(
      "missing",
      "Mangler gyldig signatur",
      "Bøker kan ikke deles ut før kontrakten er signert. Trykk her for å ordne signaturen.",
      "Mangler gyldig signatur – ordne signatur",
    ),
  );
}
