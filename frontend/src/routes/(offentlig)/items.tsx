import { Container, Stack, Title } from "@mantine/core";
import AuthGuard from "@/features/auth/AuthGuard";
import AffixCartIndicator from "@/features/cart/AffixCartIndicator";
import CustomerItemsOverview from "@/features/items/CustomerItemsOverview";
import MySignatureStatus from "@/features/signatures/MySignatureStatus";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/items")({
  head: () =>
    seo({
      title: "Dine bøker | Boklisten.no",
      description: "Se og administrer dine nåværende, bestilte og tidligere bøker",
    }),
  component: YourItemsPage,
});

function YourItemsPage() {
  return (
    <Container size="md">
      <Title>Dine bøker</Title>
      <AuthGuard>
        <MySignatureStatus />
        <Stack gap="xl">
          <CustomerItemsOverview />
          <AffixCartIndicator />
        </Stack>
      </AuthGuard>
    </Container>
  );
}
