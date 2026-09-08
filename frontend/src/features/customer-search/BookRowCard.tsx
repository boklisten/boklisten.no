import { Card, Group, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

/**
 * One book on a phone, where a table row does not fit: the title with the one action pinned
 * beside it, what identifies the copy under the title, and the editable facts on a row of chips.
 * Both the ordered and the handed-out lists use it, so the two tabs read the same.
 */
export default function BookRowCard({
  title,
  action,
  notes,
  chips,
}: {
  title: string;
  /** The row's one action, sitting top-right; null when there is nothing to do with the book. */
  action: ReactNode;
  /** The blid link or the peer the book goes to or comes from; rendered under the title. */
  notes?: ReactNode;
  chips?: ReactNode;
}) {
  return (
    <Card withBorder radius="md" padding="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Stack gap={4} miw={0} flex={1}>
          <Text fw={600} lh={1.3}>
            {title}
          </Text>
          {notes}
        </Stack>
        {action}
      </Group>
      {chips && (
        <Group gap={6} mt={8}>
          {chips}
        </Group>
      )}
    </Card>
  );
}
