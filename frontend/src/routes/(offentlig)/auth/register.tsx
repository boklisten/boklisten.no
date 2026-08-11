import { Container, Divider, Stack, Title } from "@mantine/core";

import VippsButton from "@/features/auth/VippsButton";
import SignupForm from "@/features/user/SignupForm";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/auth/register")({
  head: () =>
    seo({
      title: "Ny bruker | Boklisten.no",
      description:
        "Opprett en bruker hos Boklisten for å bestille pensumbøker til videregående skole eller privatisteksamen.",
    }),
  validateSearch: (search): { redirect?: string; caller?: string } => ({
    redirect: (search["redirect"] as string) || "",
    caller: (search["caller"] as string) || "",
  }),
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <>
      <Container size={"xs"}>
        <Stack>
          <Title ta={"center"}>Registrer deg</Title>
          <VippsButton verb={"register"} />
          <Divider label={"Eller, registrer deg med e-post"} />
          <SignupForm />
          <TanStackAnchor size={"sm"} to={"/auth/login"}>
            Har du allerede en konto? Logg inn
          </TanStackAnchor>
        </Stack>
      </Container>
    </>
  );
}
