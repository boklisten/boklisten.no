import { Container, Stack, Title } from "@mantine/core";
import AuthGuard from "@/features/auth/AuthGuard";
import OrderHistory from "@/features/order-history/OrderHistory";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/order-history")({
  head: () =>
    seo({
      title: "Ordrehistorikk | Boklisten.no",
      description: "Se historikken over dine ordre",
    }),
  component: OrdersPage,
});

function OrdersPage() {
  return (
    <AuthGuard>
      <Container size={"md"}>
        <Stack>
          <Title>Ordrehistorikk</Title>
          <OrderHistory />
        </Stack>
      </Container>
    </AuthGuard>
  );
}
