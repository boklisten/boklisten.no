import { Container, Stack, Title } from "@mantine/core";

import AuthLogoutComponent from "@/features/auth/AuthLogoutComponent";
import CountdownToRedirect from "@/shared/components/CountdownToRedirect";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/auth/logout")({
  head: () =>
    seo({
      title: "Du er nå logget ut | Boklisten.no",
    }),
  component: LogoutPage,
});

function LogoutPage() {
  return (
    <Container size="md">
      <Stack>
        <Title ta="center">Du er nå logget ut</Title>
        <CountdownToRedirect seconds={5} path="/" shouldReplaceInHistory />
        <AuthLogoutComponent />
      </Stack>
    </Container>
  );
}
