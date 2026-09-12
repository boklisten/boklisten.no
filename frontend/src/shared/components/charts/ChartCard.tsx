import { Card, Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export default function ChartCard({
  title,
  description,
  action,
  isEmpty,
  children,
}: {
  title: string;
  description?: string;
  /** A control that changes how the chart reads, placed beside the title. */
  action?: ReactNode;
  isEmpty?: boolean;
  children: ReactNode;
}) {
  return (
    <Card withBorder padding="lg" radius="md" h="100%">
      <Stack gap="xs" h="100%">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Stack gap={2}>
            <Title order={3}>{title}</Title>
            {description && (
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            )}
          </Stack>
          {action}
        </Group>
        {isEmpty ? (
          <Text c="dimmed" fs="italic" py="xl" ta="center">
            Ingen data å vise
          </Text>
        ) : (
          children
        )}
      </Stack>
    </Card>
  );
}
