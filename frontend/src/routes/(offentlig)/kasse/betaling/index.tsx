import { Container, Title } from "@mantine/core";

import { showErrorNotification } from "@/shared/utils/notifications";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import { useEffect } from "react";

export const Route = createFileRoute("/(offentlig)/kasse/betaling/")({
  head: () =>
    seo({
      title: "Betaling | Boklisten.no",
    }),
  validateSearch: (search) => ({
    checkoutFrontendUrl: (search["checkoutFrontendUrl"] as string) || "",
    token: (search["token"] as string) || "",
  }),
  component: PaymentPage,
});

const iFrameContainerId = "vipps-checkout-frame-container";
function PaymentPage() {
  const { checkoutFrontendUrl, token } = Route.useSearch();

  if (!checkoutFrontendUrl || !token)
    return (
      <ErrorAlert title={"Klarte ikke vise betalingsside"}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  useEffect(() => {
    try {
      /* @ts-expect-error official Vipps Checkout */
      VippsCheckout({
        iFrameContainerId,
        checkoutFrontendUrl,
        token,
        language: "nb",
      });
    } catch (error) {
      showErrorNotification("Klarte ikke vise betalingsside");
      console.error(error);
    }
  }, [checkoutFrontendUrl, token]);
  return (
    <Container>
      <Title ta={"center"}>Betaling</Title>
      <section id={iFrameContainerId}></section>
    </Container>
  );
}
