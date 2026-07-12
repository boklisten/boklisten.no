import { Container, Stack, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import AdminMatchOverview from "@/features/matches/adminOverview/AdminMatchOverview";

export const Route = createFileRoute("/(administrasjon)/admin/overleveringer/")({
  head: () => ({
    meta: [{ title: "Overleveringer | bl-admin" }],
  }),
  component: AdminMatchOverviewPage,
});

function AdminMatchOverviewPage() {
  return (
    <Container size={"lg"} py={"lg"}>
      <Stack gap={"lg"}>
        <Title order={1}>Overleveringer</Title>
        <AdminMatchOverview />
      </Stack>
    </Container>
  );
}
