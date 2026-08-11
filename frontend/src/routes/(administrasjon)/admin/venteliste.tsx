import { Stack, Title } from "@mantine/core";
import WaitingList from "@/features/waiting-list/WaitingList";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/venteliste")({
  head: () =>
    seo({
      title: "Venteliste | bl-admin",
    }),
  component: WaitingListPage,
});

function WaitingListPage() {
  return (
    <Stack>
      <Title>Venteliste</Title>
      <WaitingList />
    </Stack>
  );
}
