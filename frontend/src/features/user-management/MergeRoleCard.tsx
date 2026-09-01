import { Badge, Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconTrash, IconUserCheck } from "@tabler/icons-react";

import type { DuplicateUserSummary } from "@/features/user-management/duplicateTypes";
import { norwegianTime } from "@/shared/utils/dayjs";

/** Summarizes one side of a customer merge: who is kept and who is deleted. */
export default function MergeRoleCard({
  user,
  mergeRole,
  branchName,
}: {
  user: DuplicateUserSummary;
  mergeRole: "delete" | "keep";
  branchName?: string;
}) {
  const isKeep = mergeRole === "keep";
  return (
    <Paper
      withBorder
      radius="md"
      p="sm"
      style={{
        borderColor: `var(--mantine-color-${isKeep ? "green" : "red"}-6)`,
      }}
    >
      <Group wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" color={isKeep ? "green" : "red"} radius="md">
          {isKeep ? <IconUserCheck size={18} /> : <IconTrash size={18} />}
        </ThemeIcon>
        <Stack gap={2} miw={0}>
          <Text size="xs" fw={700} c={isKeep ? "green" : "red"} tt="uppercase">
            {isKeep ? "Beholdes" : "Slettes"}
          </Text>
          <Group gap="xs">
            <Text fw={600}>{user.name || "Uten navn"}</Text>
            {branchName && (
              <Badge variant="light" size="sm">
                {branchName}
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>
            {user.email}
            {user.phone ? ` · ${user.phone}` : ""}
          </Text>
          <Text size="sm" c="dimmed">
            {user.activeBooks} aktive bøker · {user.orderedItems} bestilte bøker ·{" "}
            {user.activeMatches} aktive overleveringer
          </Text>
          <Text size="sm" c="dimmed">
            Sist aktiv: {user.lastActive ? norwegianTime(user.lastActive).fromNow() : "aldri"}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}
