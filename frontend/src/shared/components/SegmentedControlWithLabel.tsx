import { Input, SegmentedControl } from "@mantine/core";
import type { SegmentedControlProps } from "@mantine/core";
import { useId } from "@mantine/hooks";
import type { ReactNode } from "react";

/**
 * A segmented control with the label and description every other input has. The label is a div
 * (there is no single input to point a <label> at) and names the radio group instead.
 */
export default function SegmentedControlWithLabel({
  label,
  description,
  ...props
}: SegmentedControlProps & { label: string; description?: ReactNode }) {
  const id = useId();
  return (
    <Input.Wrapper
      id={id}
      label={label}
      description={description}
      labelElement="div"
      // The control is inline-flex; its own line keeps it under the label
      inputContainer={(children) => <div>{children}</div>}
    >
      <SegmentedControl
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        {...props}
      />
    </Input.Wrapper>
  );
}
