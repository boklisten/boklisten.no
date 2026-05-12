import { Container, Stack, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import CustomerItemsReport from "@/features/reports/CustomerItemsReport";
import OrdersReport from "@/features/reports/OrdersReport";
import PaymentsReport from "@/features/reports/PaymentsReport";
import UserDetailsReport from "@/features/reports/UserDetailsReport";

export const Route = createFileRoute("/(administrasjon)/admin/database/rapporter")({
  component: DatabaseReportsPage,
});

function DatabaseReportsPage() {
  return (
    <Container size={"md"} py={"lg"}>
      <Stack gap={"lg"}>
        <Title order={1}>Rapporter</Title>
        <CustomerItemsReport />
        <OrdersReport />
        <PaymentsReport />
        <UserDetailsReport />
      </Stack>
    </Container>
  );
}
