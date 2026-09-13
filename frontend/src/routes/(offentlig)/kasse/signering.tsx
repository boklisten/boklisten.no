import { Container, Stack, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import AuthGuard from "@/features/auth/AuthGuard";
import CheckoutSignature, { CheckoutSignaturePending } from "@/features/checkout/CheckoutSignature";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/kasse/signering")({
  head: () =>
    seo({
      title: "Signer låneavtale | Boklisten.no",
    }),
  component: CheckoutSignaturePage,
});

function CheckoutSignaturePage() {
  return (
    <AuthGuard>
      <Container size="sm">
        <Stack>
          <Title>Signer låneavtale</Title>
          <Suspense fallback={<CheckoutSignaturePending />}>
            <CheckoutSignature />
          </Suspense>
        </Stack>
      </Container>
    </AuthGuard>
  );
}
