import { Container, Stack, Title, Text } from "@mantine/core";
import AuthGuard from "@/features/auth/AuthGuard";
import PublicBlidSearch from "@/features/blid-search/PublicBlidSearch";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/sjekk")({
  head: () =>
    seo({
      title: "Boksøk | Boklisten.no",
      description: "Sjekk hvem bøker utdelt fra Boklisten tilhører",
    }),
  component: PublicBlidSearchPage,
});

function PublicBlidSearchPage() {
  return (
    <Container size="xs">
      <Stack>
        <Title ta="center">Boksøk</Title>
        <Text ta="center">
          Skann bokas unike ID, eller skriv den inn (8 eller 12 tegn), for å se hvem boka tilhører.
        </Text>
        <AuthGuard>
          <PublicBlidSearch />
        </AuthGuard>
      </Stack>
    </Container>
  );
}
