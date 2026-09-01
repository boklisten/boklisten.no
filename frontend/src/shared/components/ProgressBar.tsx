import { Group, Progress, Stack } from "@mantine/core";
import { IconCircleCheckFilled } from "@tabler/icons-react";
import type { ReactNode } from "react";

export default function ProgressBar({
  percentComplete,
  subtitle,
}: {
  percentComplete: number;
  subtitle?: ReactNode;
}) {
  const finished = percentComplete >= 100;

  if (finished) {
    return (
      <Group gap={5}>
        <IconCircleCheckFilled color="green" />
        {subtitle}
      </Group>
    );
  }

  return (
    <Stack gap={5}>
      <Progress value={percentComplete} color="green" />
      {subtitle}
    </Stack>
  );
}
