import { Button, Container, Loader, Stack, Title } from "@mantine/core";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import useAuthLinker from "@/shared/hooks/useAuthLinker";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { hasPendingTasks } from "@/shared/utils/tasks";
import { useEffect, useEffectEvent, useState } from "react";
import { login } from "@/shared/hooks/useAuth";
import { stringParam } from "@/shared/utils/searchParams";

export const Route = createFileRoute("/(offentlig)/auth/token")({
  head: () =>
    seo({
      title: "Logger inn... | Boklisten.no",
      description: "Du blir nå logget inn. Vennligst vent.",
    }),
  validateSearch: (search) => ({
    refreshToken: stringParam(search["refresh_token"]),
    accessToken: stringParam(search["access_token"]),
  }),
  component: TokenPage,
});

function TokenPage() {
  const { client } = useApiClient();
  const { redirectToCaller } = useAuthLinker();
  const { refreshToken, accessToken } = Route.useSearch();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);

  const onLogin = useEffectEvent(async (tokens: { accessToken: string; refreshToken: string }) => {
    const success = login(tokens);
    if (!success) {
      void navigate({ to: "/auth/failure" });
      return;
    }
    let userDetail;
    try {
      userDetail = await client.api.userDetail.getMyDetails({});
    } catch {
      // Typically a dropped connection; leave the user a way out instead of spinning forever
      setHasFailed(true);
      return;
    }
    if (hasPendingTasks(userDetail)) {
      void navigate({ to: "/oppgaver" });
    } else {
      redirectToCaller();
    }
  });
  useEffect(() => {
    if (accessToken && refreshToken) {
      // oxlint-disable-next-line react/set-state-in-effect -- setHasFailed only runs after an awaited network call, never synchronously during the effect
      void onLogin({ accessToken, refreshToken });
    }
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `attempt` deliberately re-runs the login when the user retries
  }, [accessToken, refreshToken, attempt]);

  if (hasFailed) {
    return (
      <Container size={"xs"}>
        <Stack align={"center"}>
          <ErrorAlert title={"Klarte ikke fullføre innloggingen"}>
            {PLEASE_TRY_AGAIN_TEXT}
          </ErrorAlert>
          <Button
            onClick={() => {
              setHasFailed(false);
              setAttempt((previous) => previous + 1);
            }}
          >
            Prøv igjen
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size={"xs"}>
      <Stack align={"center"}>
        <Title>Du blir nå logget inn...</Title>
        <Loader />
      </Stack>
    </Container>
  );
}
