import { SegmentedControl, Stack, Text } from "@mantine/core";
import type { SegmentedControlProps } from "@mantine/core";

export default function SegmentedControlWithLabel(
  props: SegmentedControlProps & { label: string },
) {
  return (
    <Stack gap={3}>
      <Text size="sm" fw={500}>
        {props.label}
      </Text>
      <SegmentedControl {...props} />
    </Stack>
  );
}
