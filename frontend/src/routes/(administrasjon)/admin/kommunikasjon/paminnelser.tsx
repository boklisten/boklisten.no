import { Container, Stack, Title, Text } from "@mantine/core";
import Reminders from "@/features/reminders/Reminders";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/kommunikasjon/paminnelser")({
  head: () =>
    seo({
      title: "Påminnelser | bl-admin",
    }),
  component: RemindersPage,
});

function RemindersPage() {
  return (
    <Container size={"xs"}>
      <Stack>
        <Stack gap={2}>
          <Title>Påminnelser</Title>
          <Text size={"sm"} c={"dimmed"}>
            Send SMS eller e-post til elever med aktive bøker på valgte filialer
          </Text>
        </Stack>
        <Reminders />
      </Stack>
    </Container>
  );
}
