import { Input, SegmentedControl, Stack } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";

import {
  DATE_RANGE_PRESETS,
  DATE_RANGE_PRESET_LABELS,
  type DateRangePreset,
  type DateRangeValue,
} from "@/features/reports/dateRangePresets";

interface DateRangePresetFieldProps {
  label: string;
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}

export default function DateRangePresetField({
  label,
  value,
  onChange,
}: DateRangePresetFieldProps) {
  return (
    <Input.Wrapper label={label}>
      <Stack gap={"xs"}>
        <SegmentedControl
          value={value.preset}
          onChange={(next) => onChange({ ...value, preset: next as DateRangePreset })}
          data={DATE_RANGE_PRESETS.map((preset) => ({
            value: preset,
            label: DATE_RANGE_PRESET_LABELS[preset],
          }))}
        />
        {value.preset === "custom" && (
          <DatePickerInput
            type={"range"}
            placeholder={"Velg datointervall"}
            valueFormat={"DD/MM/YYYY"}
            clearable
            value={value.customRange}
            onChange={(next) =>
              onChange({
                ...value,
                customRange: [
                  next[0] ? new Date(next[0]) : null,
                  next[1] ? new Date(next[1]) : null,
                ],
              })
            }
          />
        )}
      </Stack>
    </Input.Wrapper>
  );
}
