import { Card, Stack } from "@mantine/core";
import type { ReactNode } from "react";

import classes from "@/features/matches/matchesList/MatchListItemCard.module.css";
import TanStackButton from "@/shared/components/TanStackButton";

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
  const buttonProps = {
    className: classes.open,
    mt: "md",
    variant: finished ? "transparent" : "filled",
    color: "green",
    children: "Åpne",
  } as const;

  return (
    <Card
      className={classes.card}
      shadow={finished ? "xs" : "lg"}
      withBorder
      bg={finished ? "rgba(134, 200, 134, 0.2)" : ""}
    >
      <Stack gap="xs">
        {children}
        {admin ? (
          <TanStackButton
            {...buttonProps}
            to="/admin/database/filialer"
            search={(previous) => ({ ...previous, overlevering: matchId })}
          />
        ) : (
          <TanStackButton {...buttonProps} to="/overleveringer/$matchId" params={{ matchId }} />
        )}
      </Stack>
    </Card>
  );
}
