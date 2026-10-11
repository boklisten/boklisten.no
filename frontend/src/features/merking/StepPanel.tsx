import { Box, Group, Paper, Text } from "@mantine/core";
import type { ReactNode } from "react";

import StepLabel from "@/features/merking/StepLabel";

/** A step as a panel: the step label in a band that takes the primary tint once the step is done. */
export default function StepPanel({
  step,
  done,
  label,
  aside,
  children,
}: {
  /** Omitted where the sequence is not in view (the camera modal). */
  step?: number;
  done: boolean;
  label: string;
  /** Right of the label in the band. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper
      withBorder
      radius="md"
      h="100%"
      style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <Group
        justify="space-between"
        wrap="nowrap"
        gap="sm"
        px="md"
        py="xs"
        style={{
          background: done
            ? "var(--mantine-primary-color-light)"
            : "var(--mantine-color-default-hover)",
        }}
      >
        {step === undefined ? (
          <Text fw={600}>{label}</Text>
        ) : (
          <StepLabel step={step} done={done}>
            {label}
          </StepLabel>
        )}
        {aside}
      </Group>
      <Box flex={1} miw={0} style={{ display: "flex", flexDirection: "column" }}>
        {children}
      </Box>
    </Paper>
  );
}
