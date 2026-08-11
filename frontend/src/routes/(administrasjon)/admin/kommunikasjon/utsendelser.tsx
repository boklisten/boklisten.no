import { Container, Stack, Text, Title } from "@mantine/core";
import DispatchManager from "@/features/dispatches/DispatchManager";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/kommunikasjon/utsendelser")({
  head: () =>
    seo({
      title: "Utsendelser | bl-admin",
    }),
  component: DispatchPage,
});

function DispatchPage() {
  return (
    <Container size={"sm"}>
      <Stack>
        <Stack gap={2}>
          <Title>Utsendelser</Title>
          <Text size={"sm"} c={"dimmed"}>
            Send SMS og/eller e-post til en liste med mottakere
          </Text>
        </Stack>
        <DispatchManager />
      </Stack>
    </Container>
  );
}
