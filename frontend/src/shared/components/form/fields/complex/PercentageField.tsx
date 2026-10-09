import { Input, Slider } from "@mantine/core";
import type { SliderProps } from "@mantine/core";
import { useId } from "@mantine/hooks";

import { useFieldContext } from "@/shared/hooks/form";

export default function PercentageField(props: { slider?: SliderProps; label: string }) {
  const field = useFieldContext<number>();
  const id = useId();

  return (
    <Input.Wrapper id={id} label={props.label} labelElement="div" mb="md">
      <Slider
        miw={200}
        thumbProps={{ "aria-labelledby": `${id}-label` }}
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
        // Dragging changes the value on every step; the choice is made on release.
        onChangeEnd={field.handleBlur}
        onBlur={field.handleBlur}
      />
    </Input.Wrapper>
  );
}
