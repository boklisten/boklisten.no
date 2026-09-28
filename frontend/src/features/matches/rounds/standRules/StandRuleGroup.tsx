import { ActionIcon, Badge, Group, Paper, Stack, Text, Tooltip } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";

/**
 * One branch or student whose books all go via the stand. Branches and students share this row
 * so the two lists in the plan form read as one rule applied to two kinds of things.
 */
export function StandRuleRow({
  leading,
  title,
  description,
  removeLabel,
  onRemove,
}: {
  /** A student's avatar, or a branch icon at the same size. */
  leading: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <Paper withBorder radius="sm" px="sm" py={8}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          {leading}
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text fw={500} size="sm" truncate>
              {title}
            </Text>
            {description && (
              <Text size="xs" c="dimmed" truncate>
                {description}
              </Text>
            )}
          </Stack>
        </Group>
        <Tooltip label={removeLabel}>
          <ActionIcon variant="subtle" color="gray" aria-label={removeLabel} onClick={onRemove}>
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Paper>
  );
}

/** A heading with a count, the chosen rows, and the control that adds another. */
export function StandRuleGroup({
  title,
  count,
  children,
  addControl,
}: {
  title: string;
  count: number;
  children: ReactNode;
  addControl: ReactNode;
}) {
  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Text size="sm" fw={600}>
          {title}
        </Text>
        {count > 0 && (
          <Badge size="sm" variant="light" color="teal" circle>
            {count}
          </Badge>
        )}
      </Group>
      {children}
      {addControl}
    </Stack>
  );
}
