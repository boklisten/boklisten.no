import { Loader } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import CountdownToRedirect from "@/shared/components/CountdownToRedirect";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { publicApi } from "@/shared/utils/publicApiClient";

export default function EmailVerifier({ verificationId }: { verificationId: string }) {
  const { isPending, isError } = useQuery(
    publicApi.emailVerification.verify.queryOptions({ params: { id: verificationId } }),
  );

  if (isPending) {
    return (
      <InfoAlert icon={<Loader size="xs" />} variant="light" title="Bekrefter e-post...">
        Vennligst vent mens vi bekrefter din e-post
      </InfoAlert>
    );
  }

  if (isError) {
    return (
      <>
        <ErrorAlert title="Klarte ikke bekrefte e-post">
          Lenken kan være utløpt. Du kan prøve å sende en ny lenke fra brukerinnstillinger.
        </ErrorAlert>
        <TanStackAnchor to="/user-settings">Gå til brukerinnstillinger</TanStackAnchor>
      </>
    );
  }

  return (
    <>
      <SuccessAlert title="E-postadressen ble bekreftet!" />
      <CountdownToRedirect path="/" seconds={5} />
    </>
  );
}
