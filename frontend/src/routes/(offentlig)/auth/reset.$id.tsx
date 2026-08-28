import { Container, Stack, Title } from "@mantine/core";

import PasswordReset from "@/features/auth/PasswordReset";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import { stringParam } from "@/shared/utils/searchParams";

export const Route = createFileRoute("/(offentlig)/auth/reset/$id")({
  head: () =>
    seo({
      title: "Lag nytt passord | Boklisten.no",
      description: "Lag et nytt passord, slik at du får tilgang på kontoen din.",
    }),
  validateSearch: (search) => ({
    resetToken: stringParam(search["token"]),
  }),
  component: PasswordResetPage,
});

function PasswordResetPage() {
  const { id } = Route.useParams();
  return (
    <Container size={"xs"}>
      <Stack>
        <Title>Lag nytt passord</Title>
        <PasswordReset id={id} />
      </Stack>
    </Container>
  );
}
