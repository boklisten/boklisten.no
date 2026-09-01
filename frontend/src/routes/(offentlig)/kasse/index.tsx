import { Container, Stack } from "@mantine/core";

import AuthGuard from "@/features/auth/AuthGuard";
import CheckoutHandler from "@/features/checkout/CheckoutHandler";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/kasse/")({
  head: () =>
    seo({
      title: "Kasse | Boklisten.no",
    }),
  component: CheckoutPage,
});

function CheckoutPage() {
  return (
    <AuthGuard>
      <Container size="md">
        <Stack align="center" gap="xs">
          <CheckoutHandler />
        </Stack>
      </Container>
    </AuthGuard>
  );
}
