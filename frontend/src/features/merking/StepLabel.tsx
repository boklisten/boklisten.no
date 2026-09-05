import { Group, Text, ThemeIcon } from "@mantine/core";

/**
 * The page is a three-step sequence (book, stickers, confirm), so each part carries its number.
 * A step that is done fills its badge.
 */
export default function StepLabel({
  step,
  done = false,
  children,
}: {
  step: number;
  done?: boolean;
  children: string;
}) {
  return (
    <Group gap="xs" wrap="nowrap">
      <ThemeIcon size="sm" radius="xl" variant={done ? "filled" : "light"}>
        <Text size="xs" fw={700} lh={1}>
          {step}
        </Text>
      </ThemeIcon>
      <Text fw={600}>{children}</Text>
    </Group>
  );
}
