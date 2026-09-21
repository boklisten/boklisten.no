import { Button, Container, Loader, Stack, Title } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useState } from "react";

import { authQueryOptions } from "@/features/auth/authQuery";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useLoginRedirect from "@/shared/hooks/useLoginRedirect";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { seo } from "@/shared/utils/seo";
import { hasPendingTasks } from "@/shared/utils/tasks";

/**
 * Where the API sends the browser after a login it completed itself (Vipps, the local test
 * login link). The session cookie is already set; this page reads who it belongs to and
 * continues to wherever the login was heading.
 */
export const Route = createFileRoute("/(offentlig)/auth/callback")({
  head: () =>
    seo({
      title: "Logger inn... | Boklisten.no",
      description: "Du blir nå logget inn. Vennligst vent.",
    }),
  component: CallbackPage,
});

function CallbackPage() {
  const queryClient = useQueryClient();
  const { redirectToTarget } = useLoginRedirect();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);

  const onArrive = useEffectEvent(async () => {
    const user = await queryClient
      .query({ ...authQueryOptions(), staleTime: 0 })
      .catch(() => undefined);
    if (user === undefined) {
      // Typically a dropped connection; leave the user a way out instead of spinning forever
      setHasFailed(true);
      return;
    }
    if (user === null) {
      void navigate({ to: "/auth/failure" });
      return;
    }
    if (hasPendingTasks(user)) {
      void navigate({ to: "/oppgaver" });
    } else {
      redirectToTarget();
    }
  });
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- setHasFailed only runs after an awaited network call, never synchronously during the effect
    void onArrive();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `attempt` deliberately re-runs the lookup when the user retries
  }, [attempt]);

  if (hasFailed) {
    return (
      <Container size="xs">
        <Stack align="center">
          <ErrorAlert title="Klarte ikke fullføre innloggingen">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
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
    <Container size="xs">
      <Stack align="center">
        <Title>Du blir nå logget inn...</Title>
        <Loader />
      </Stack>
    </Container>
  );
}
