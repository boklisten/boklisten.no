import { Container, Group, Stack, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import LegacyAppLink from "@/features/auth-linker/LegacyAppLink";
import CustomerItemsReport from "@/features/reports/CustomerItemsReport";
import OrdersReport from "@/features/reports/OrdersReport";
import PaymentsReport from "@/features/reports/PaymentsReport";
import UserDetailsReport from "@/features/reports/UserDetailsReport";

export const Route = createFileRoute("/(administrasjon)/admin/database/rapporter")({
  component: DatabaseReportsPage,
});

function DatabaseReportsPage() {
  return (
    <Container size="md" py="lg">
      <Stack gap="lg">
        <Group gap="xs">
          <Title order={1}>Rapporter</Title>
          <LegacyAppLink path="database/reports" label="Gå til gammelt rapport-system" />
        </Group>
        <CustomerItemsReport />
        <OrdersReport />
        <PaymentsReport />
        <UserDetailsReport />
      </Stack>
    </Container>
  );
}
