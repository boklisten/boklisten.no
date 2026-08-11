import { Container, Stack, Title, Text } from "@mantine/core";
import AuthGuard from "@/features/auth/AuthGuard";
import PublicBlidSearch from "@/features/info/PublicBlidSearch";
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
    <Container size={"xs"}>
      <Stack>
        <Title ta={"center"}>Boksøk</Title>
        <Text ta={"center"}>
          Skriv inn en bok sin unike ID (8 eller 12 siffer) for å se hvem den tilhører. Du kan også
          skanne bokas unike ID med kamera.
        </Text>
        <AuthGuard>
          <PublicBlidSearch />
        </AuthGuard>
      </Stack>
    </Container>
  );
}
