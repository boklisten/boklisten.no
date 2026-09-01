import { Progress, Stack, Title } from "@mantine/core";
import { useWindowScroll } from "@mantine/hooks";
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

  const [, scrollTo] = useWindowScroll();

  const onIntervalStart = useEffectEvent(() => {
    scrollTo({ y: 0 });
    const interval = setInterval(() => {
      setProgress((previousProgress) => {
        if (previousProgress <= 0) {
          clearInterval(interval);
          return 0;
        }
        return previousProgress - 10 / seconds;
      });
    }, 100);
    return interval;
  });
  useEffect(() => {
    const interval = onIntervalStart();
    return () => {
      clearInterval(interval);
    };
  }, []);

  const onIntervalEnd = useEffectEvent(() => {
    if (shouldRedirectToCaller) {
      return redirectToCaller();
    }
    if (path) {
      void navigate({ to: path, replace: shouldReplaceInHistory });
    }
  });
  useEffect(() => {
    if (progress <= 0) {
      onIntervalEnd();
    }
  }, [progress]);

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
