import { Button, Card, Stack } from "@mantine/core";
import type { ReactNode } from "react";

import TanStackAnchor from "@/shared/components/TanStackAnchor";

export default function MatchListItemCard({
  finished,
  matchId,
  admin = false,
  children,
}: {
  finished: boolean;
  matchId: string;
  admin?: boolean;
  children: ReactNode;
}) {
  return (
    <TanStackAnchor
      underline={"never"}
      to={admin ? "/admin/overleveringer/$matchId" : "/overleveringer/$matchId"}
      params={{ matchId }}
      search={admin ? (previous) => previous : undefined}
    >
      <Card
        shadow={finished ? "xs" : "lg"}
        withBorder
        bg={finished ? "rgba(134, 200, 134, 0.2)" : ""}
      >
        <Stack gap={"xs"}>
          {children}
          <Button mt={"md"} variant={finished ? "transparent" : "filled"} color={"green"}>
            Åpne
          </Button>
        </Stack>
      </Card>
    </TanStackAnchor>
  );
}
