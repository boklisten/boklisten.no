import { SegmentedControl, Stack, Text } from "@mantine/core";
import type { SegmentedControlProps } from "@mantine/core";
import type { ReactNode } from "react";

export default function SegmentedControlWithLabel({
  label,
  description,
  ...props
}: SegmentedControlProps & { label: string; description?: ReactNode }) {
  return (
    <Stack gap={3}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <SegmentedControl {...props} />
      {description && (
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      )}
    </Stack>
  );
}
