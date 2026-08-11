import { Center, Container, Divider, Stack, Title } from "@mantine/core";

import LocalSignIn from "@/features/auth/LocalSignIn";
import VippsButton from "@/features/auth/VippsButton";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/auth/login")({
  head: () =>
    seo({
      title: "Logg inn | Boklisten.no",
      description:
        "Logg inn på Boklisten for å bestille pensumbøker, se status på bøkene du har, og finne ordrehistorikken din.",
    }),
  validateSearch: (search): { redirect?: string; caller?: string } => ({
    redirect: (search["redirect"] as string) || "",
    caller: (search["caller"] as string) || "",
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <Container size={"xs"}>
      <Stack>
        <Title ta={"center"}>Logg inn</Title>
        <Center>
          <VippsButton verb={"login"} />
        </Center>
        <Divider w={"100%"} label={"eller"}></Divider>
        <LocalSignIn />
      </Stack>
    </Container>
  );
}
