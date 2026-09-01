import { Container, Stack, Title } from "@mantine/core";

import VippsCheckoutStatus from "@/features/payment/VippsCheckoutStatus";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import { stringParam } from "@/shared/utils/searchParams";

export const Route = createFileRoute("/(offentlig)/kasse/betaling/status")({
  head: () =>
    seo({
      title: "Kvittering | Boklisten.no",
    }),
  component: CheckoutStatusPage,
  validateSearch: (search) => ({
    orderId: stringParam(search["orderId"]),
  }),
});

function CheckoutStatusPage() {
  const { orderId } = Route.useSearch();

  return (
    <Container size="md">
      <Stack>
        <Title ta="center">Betaling</Title>
        <VippsCheckoutStatus orderId={orderId} />
      </Stack>
    </Container>
  );
}
