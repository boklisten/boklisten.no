import { Button, Center, Code, CopyButton, Stack } from "@mantine/core";
import {
  useColorScheme,
  useDocumentVisibility,
  useNetwork,
  useOrientation,
  useOs,
  useReducedMotion,
  useViewportSize,
} from "@mantine/hooks";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import dayjs from "dayjs";
import { Activity, useEffect } from "react";

import Logo from "@/features/layout/Logo";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useAuth from "@/shared/hooks/useAuth";
import { useLocation } from "@tanstack/react-router";
import * as Sentry from "@sentry/tanstackstart-react";

function ErrorBoundary({
  error,
  withLogo,
  href,
}: {
  error: Error;
  withLogo?: boolean;
  href?: string;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  const os = useOs();
  const orientation = useOrientation();
  const { isLoggedIn } = useAuth();
  const { pathname, searchStr } = useLocation();

  const { width, height } = useViewportSize();
  const network = useNetwork();
  const colorScheme = useColorScheme();
  const reducedMotion = useReducedMotion();
  const visibility = useDocumentVisibility();

  const debugText = `----- DEBUG START -----

Timestamp: ${dayjs().toISOString()}

--- ROUTING ---
Pathname: ${pathname}
Search params: ${searchStr || "none"}

--- AUTH ---
isLoggedIn: ${isLoggedIn}

--- ERROR ---
Name: ${error.name}
Message: ${error.message}
Stack: ${error.stack ?? "n/a"}

--- UI ---
OS: ${os}
Orientation: ${orientation.type}
Color scheme: ${colorScheme}
Reduced motion: ${reducedMotion}
Document visibility: ${visibility}

--- VIEWPORT ---
Size: ${width} x ${height}
DPR: ${typeof window !== "undefined" ? window.devicePixelRatio : "n/a"}

--- BROWSER ---
User agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "n/a"}
Language: ${typeof navigator !== "undefined" ? navigator.language : "n/a"}
Online: ${typeof navigator !== "undefined" ? navigator.onLine : "n/a"}
Cookies enabled: ${typeof navigator !== "undefined" ? navigator.cookieEnabled : "n/a"}

--- NETWORK ---
Online: ${network.online}
Effective type: ${network.effectiveType ?? "unknown"}
Downlink: ${network.downlink ?? "unknown"}
RTT: ${network.rtt ?? "unknown"}

--- LOCATION ---
Href: ${typeof window !== "undefined" ? window.location.href : "n/a"}
Referrer: ${typeof document !== "undefined" ? document.referrer || "none" : "n/a"}

------ DEBUG END ------`;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Stack align="center">
      {withLogo && <Logo variant="blue" />}
      <ErrorAlert title="Oisann! Her gikk noe veldig galt!">
        Du kan prøve å laste inn siden på nytt, eller gå tilbake til forsiden. Ta kontakt på
        teknisk@boklisten.no dersom problemet vedvarer! Kopier feilmeldingen under inn i e-posten,
        slik at vi enklere kan hjelpe deg.
      </ErrorAlert>
      <CopyButton value={debugText}>
        {({ copied, copy }) => (
          <Button
            leftSection={copied ? <IconCheck /> : <IconCopy />}
            color={copied ? "teal" : "blue"}
            onClick={copy}
          >
            Kopier feilmelding
          </Button>
        )}
      </CopyButton>

      <Code block>{debugText}</Code>
      <Center>
        <Activity mode={href ? "visible" : "hidden"}>
          <TanStackAnchor to={href}>Gå til forsiden</TanStackAnchor>
        </Activity>
      </Center>
    </Stack>
  );
}

export default Sentry.withErrorBoundary(ErrorBoundary, {});
