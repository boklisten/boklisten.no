import { Chip, Group, Input, type MantineSize } from "@mantine/core";

import { useFieldContext } from "@/shared/hooks/form";

export default function ChipsField({
  label,
  data,
  size = "xs",
}: {
  label: string;
  data: { value: string; label: string }[];
  size?: MantineSize;
}) {
  const field = useFieldContext<string[]>();

  return (
    <Group gap={"xs"} wrap={"nowrap"}>
      <Input.Label w={70} mb={0} fw={"normal"} c={"dimmed"} fz={"sm"}>
        {label}
      </Input.Label>
      <Chip.Group multiple value={field.state.value} onChange={field.handleChange}>
        <Group gap={"xs"}>
          {data.map((option) => (
            <Chip key={option.value} value={option.value} size={size}>
              {option.label}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
    </Group>
  );
}
