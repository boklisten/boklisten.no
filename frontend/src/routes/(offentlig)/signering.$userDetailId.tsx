import { Container, Stack, Title } from "@mantine/core";
import SignAgreement from "@/features/signatures/SignAgreement";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/signering/$userDetailId")({
  head: () =>
    seo({
      title: "Signering | Boklisten.no",
      description: "Signer avtale for å få bøker fra Boklisten.no",
    }),
  component: SignaturePage,
});

function SignaturePage() {
  const { userDetailId } = Route.useParams();
  return (
    <Container size="sm">
      <Stack>
        <Title>Signering</Title>
        <SignAgreement userDetailId={userDetailId} />
      </Stack>
    </Container>
  );
}
