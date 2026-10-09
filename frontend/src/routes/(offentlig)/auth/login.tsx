import { Container } from "@mantine/core";

import SignIn from "@/features/auth/SignIn";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import { stringParam } from "@/shared/utils/searchParams";

export const Route = createFileRoute("/(offentlig)/auth/login")({
  head: () =>
    seo({
      title: "Logg inn | Boklisten.no",
      description:
        "Logg inn eller opprett konto hos Boklisten for å bestille pensumbøker, se status på bøkene du har, og finne ordrehistorikken din.",
    }),
  validateSearch: (search): { redirect?: string } => ({
    redirect: stringParam(search["redirect"]),
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <Container size="xs">
      <SignIn />
    </Container>
  );
}
