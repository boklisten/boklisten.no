import { Progress, Stack, Title } from "@mantine/core";
import { useEffect, useEffectEvent, useState } from "react";

import useAuthLinker from "@/shared/hooks/useAuthLinker";
import { useNavigate } from "@tanstack/react-router";

function CountdownToRedirect({
  seconds,
  path,
  shouldReplaceInHistory,
  shouldRedirectToCaller,
}: {
  seconds: number;
  path?: string;
  shouldReplaceInHistory?: boolean;
  shouldRedirectToCaller?: boolean;
}) {
  const { redirectToCaller } = useAuthLinker();
  const [progress, setProgress] = useState(100);
  const navigate = useNavigate();

  const redirect = useEffectEvent(() => {
    if (shouldRedirectToCaller) {
      redirectToCaller();
      return;
    }
    if (path) {
      void navigate({ to: path, replace: shouldReplaceInHistory });
    }
  });

  useEffect(() => {
    window.scrollTo({ top: 0 });
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      if (elapsedSeconds < seconds) {
        setProgress(100 - (elapsedSeconds / seconds) * 100);
        return;
      }
      clearInterval(interval);
      setProgress(0);
      redirect();
    }, 100);
    return () => clearInterval(interval);
  }, [seconds]);

  return (
    <Stack>
      <Title order={6} ta="center">
        Du blir videresendt om {Math.ceil((progress / 100) * seconds)} sekunder...
      </Title>
      <Progress value={progress} color="green" />
    </Stack>
  );
}

export default CountdownToRedirect;
