import type { SegmentedControlProps } from "@mantine/core";
import type { ReactNode } from "react";

import SegmentedControlWithLabel from "@/shared/components/SegmentedControlWithLabel";
import { commitValue, useFieldContext } from "@/shared/hooks/form";

export default function SegmentedControlField(
  props: SegmentedControlProps & { label: string; description?: ReactNode },
) {
  const field = useFieldContext<string>();
  return (
    <SegmentedControlWithLabel
      {...props}
      value={field.state.value}
      onChange={(value) => commitValue(field, value)}
      onBlur={field.handleBlur}
    />
  );
}
