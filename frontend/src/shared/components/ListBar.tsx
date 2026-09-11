import { Button, Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import type { ReactNode } from "react";

/**
 * A list that is not on screen right now, one line high, sitting between the page's controls and
 * the thing it belongs to: what is in it, a detail or two, and the one way in. Inline rather than
 * floating, so it never hides the rows beneath it.
 */
export default function ListBar({
  icon,
  label,
  heading,
  detail = null,
  action,
}: {
  icon: ReactNode;
  /** Accessible name of the bar as a group. */
  label: string;
  heading: string;
  /** Small lines under the heading. */
  detail?: ReactNode;
  /** The way in; the short label is for phones, where the full one does not fit beside the text. */
  action: { full: string; short: string; onPress: () => void };
}) {
  return (
    <Paper withBorder radius="md" py="xs" px="sm" role="group" aria-label={label}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap" miw={0}>
          <ThemeIcon variant="light" size="lg" radius="xl">
            {icon}
          </ThemeIcon>
          <Stack gap={0} miw={0}>
            <Text fw={600} lh={1.2} size="sm">
              {heading}
            </Text>
            {detail}
          </Stack>
        </Group>
        <Button color="green" onClick={action.onPress} flex="0 0 auto" visibleFrom="sm">
          {action.full}
        </Button>
        <Button color="green" onClick={action.onPress} flex="0 0 auto" hiddenFrom="sm">
          {action.short}
        </Button>
      </Group>
    </Paper>
  );
}
