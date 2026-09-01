import { Container, Title } from "@mantine/core";

import { showErrorNotification } from "@/shared/utils/notifications";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { createFileRoute } from "@tanstack/react-router";
import loadScriptOnce from "@/shared/utils/loadScriptOnce";
import { seo } from "@/shared/utils/seo";
import { useEffect } from "react";
import { stringParam } from "@/shared/utils/searchParams";

export const Route = createFileRoute("/(offentlig)/kasse/betaling/")({
  head: () =>
    seo({
      title: "Betaling | Boklisten.no",
    }),
  validateSearch: (search) => ({
    checkoutFrontendUrl: stringParam(search["checkoutFrontendUrl"]),
    token: stringParam(search["token"]),
  }),
  component: PaymentPage,
});

const iFrameContainerId = "vipps-checkout-frame-container";
function PaymentPage() {
  const { checkoutFrontendUrl, token } = Route.useSearch();

  useEffect(() => {
    if (!checkoutFrontendUrl || !token) {
      return undefined;
    }
    let cancelled = false;
    loadScriptOnce("https://checkout.vipps.no/vippsCheckoutSDK.js")
      .then(() => {
        if (cancelled) {
          return undefined;
        }
        /* @ts-expect-error official Vipps Checkout */
        return VippsCheckout({
          iFrameContainerId,
          checkoutFrontendUrl,
          token,
          language: "nb",
        });
      })
      .catch((error) => {
        showErrorNotification("Klarte ikke vise betalingsside");
        console.error(error);
      });
    return () => {
      cancelled = true;
    };
  }, [checkoutFrontendUrl, token]);

  if (!checkoutFrontendUrl || !token) {
    return <ErrorAlert title="Klarte ikke vise betalingsside">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }
  return (
    <Container>
      <Title ta="center">Betaling</Title>
      <section id={iFrameContainerId} />
    </Container>
  );
}
