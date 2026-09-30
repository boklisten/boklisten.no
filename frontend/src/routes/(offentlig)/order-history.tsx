import { Container, Stack, Title } from "@mantine/core";
import AuthGuard from "@/features/auth/AuthGuard";
import { PlacedOrderNotice } from "@/features/checkout/OrderPlacedAlert";
import OrderHistory from "@/features/order-history/OrderHistory";
import MySignatureStatusCard from "@/features/signatures/MySignatureStatusCard";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/order-history")({
  head: () =>
    seo({
      title: "Ordrehistorikk | Boklisten.no",
      description: "Se historikken over dine ordre",
    }),
  component: OrdersPage,
  // The order the customer just placed without paying, whose confirmation this page shows
  validateSearch: (search) => ({
    bestilt: typeof search["bestilt"] === "string" ? search["bestilt"] : undefined,
  }),
});

function OrdersPage() {
  const { bestilt } = Route.useSearch();
  return (
    <AuthGuard>
      <Container size="md">
        <Stack>
          <Title>Ordrehistorikk</Title>
          {bestilt && <PlacedOrderNotice orderId={bestilt} />}
          <MySignatureStatusCard />
          <OrderHistory />
        </Stack>
      </Container>
    </AuthGuard>
  );
}
