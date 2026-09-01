import { Slider, Stack, Text } from "@mantine/core";
import type { SliderProps } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export default function PercentageField(props: { slider?: SliderProps; label: string }) {
  const field = useFieldContext<number>();

  return (
    <Stack gap={5} mb="md">
      <Text size="sm">{props.label}</Text>
      <Slider
        miw={200}
        label={`${Math.round(field.state.value * 100)}%`}
        min={0}
        max={1}
        step={0.01}
        marks={[
          { value: 0, label: "0%" },
          { value: 0.25, label: "25%" },
          { value: 0.5, label: "50%" },
          { value: 0.75, label: "75%" },
          { value: 1, label: "100%" },
        ]}
        {...props.slider}
        value={field.state.value}
        onChange={field.handleChange}
        onBlur={field.handleBlur}
      />
    </Stack>
  );
}
