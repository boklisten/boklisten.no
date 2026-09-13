import { modals } from "@mantine/modals";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { OUTGROWN_SIGNATURE_TITLE } from "@/features/signatures/outgrownSignatureCopy";
import SignatureStatusCard from "@/features/signatures/SignatureStatusCard";
import SignedSignatureDetails from "@/features/signatures/SignedSignatureDetails";
import useApiClient from "@/shared/hooks/useApiClient";

/**
 * The customer's own signature status as a compact card at the top of the pages they land on
 * after ordering. A valid signature opens in a modal so they can see what was signed; a missing
 * or outgrown one leads to the tasks page where it is signed. Nothing shows while no signature is
 * needed. Always fetched fresh: the order placed a moment ago may have created the demand.
 */
export default function MySignatureStatusCard() {
  const { api } = useApiClient();
  const navigate = useNavigate();
  const { data: userDetail } = useQuery(api.userDetail.getMyDetails.queryOptions());
  const { data, isError } = useQuery({
    ...api.signatures.getMySignature.queryOptions(),
    staleTime: 0,
  });

  // The details carry the name the modal refers to, so wait for both before showing anything
  if (!data || isError || !userDetail) {
    return null;
  }

  if (data.isSignatureValid) {
    return (
      <SignatureStatusCard
        tone="valid"
        title="Gyldig signatur"
        description={
          <>
            {/* Non-breaking spaces keep the dot with the first half and the date with
                "gyldig til", so a narrow card wraps into two tidy lines. */}
            Signert av {data.signedByGuardian ? "foresatt" : "deg"}
            {"\u00A0· gyldig\u00A0til\u00A0"}
            {data.expiresAtText}
          </>
        }
        ariaLabel="Gyldig signatur – se signaturen"
        onClick={() =>
          modals.open({
            title: "Din signatur",
            children: <SignedSignatureDetails signature={data} name={userDetail.name} />,
          })
        }
      />
    );
  }

  if (!data.signatureRequired) {
    return null;
  }

  const goSign = () => void navigate({ to: "/oppgaver" });

  if (data.outgrownGuardianSignature) {
    return (
      <SignatureStatusCard
        tone="warning"
        title={OUTGROWN_SIGNATURE_TITLE}
        description="Foresatt sin signatur gjelder ikke lenger. Trykk her for å signere låneavtalen."
        ariaLabel={`${OUTGROWN_SIGNATURE_TITLE} – signer låneavtale`}
        onClick={goSign}
      />
    );
  }

  return (
    <SignatureStatusCard
      tone="missing"
      title="Mangler gyldig signatur"
      description="Bøker kan ikke deles ut før låneavtalen er signert. Trykk her for å signere."
      ariaLabel="Mangler gyldig signatur – signer låneavtale"
      onClick={goSign}
    />
  );
}
