import { Container, Stack, Title } from "@mantine/core";

import ConfirmOrder from "@/features/checkout/ConfirmOrder";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/kasse/bekreft")({
  head: () =>
    seo({
      title: "Bekreft bestilling | Boklisten.no",
    }),
  component: CheckoutConfirmPage,
  validateSearch: (search) => ({
    orderId: (search["orderId"] as string) || "",
  }),
});

function CheckoutConfirmPage() {
  const { orderId } = Route.useSearch();
  return (
    <Container size={"md"}>
      <Stack>
        <Title>Bekreft bestilling</Title>
        <ConfirmOrder orderId={orderId} />
      </Stack>
    </Container>
  );
}
