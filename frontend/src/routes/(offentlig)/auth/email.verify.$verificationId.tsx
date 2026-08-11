import { Container, Stack, Title } from "@mantine/core";
import EmailVerifier from "@/features/user/EmailVerifier";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/auth/email/verify/$verificationId")({
  head: () =>
    seo({
      title: "Bekreft e-post | Boklisten.no",
      description: "Bekreft din e-postadresse, slik at du får viktig informasjon fra oss.",
    }),
  component: TokenPage,
});

function TokenPage() {
  const { verificationId } = Route.useParams();
  return (
    <Container>
      <Stack>
        <Title>Bekreft e-post</Title>
        <EmailVerifier verificationId={verificationId} />
      </Stack>
    </Container>
  );
}
