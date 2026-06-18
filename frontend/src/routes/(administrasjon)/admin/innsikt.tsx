import { Container, Stack, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import MatchStatistics from "@/features/insights/MatchStatistics";

export const Route = createFileRoute("/(administrasjon)/admin/innsikt")({
  head: () => ({
    meta: [{ title: "Innsikt | bl-admin" }],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  return (
    <Container size={"lg"} py={"lg"}>
      <Stack gap={"lg"}>
        <Title order={1}>Innsikt</Title>
        <MatchStatistics />
      </Stack>
    </Container>
  );
}
