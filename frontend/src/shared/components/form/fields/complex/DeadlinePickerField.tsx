import { DatePickerInput, type DatePickerInputProps } from "@mantine/dates";
import dayjs from "dayjs";

import { useFieldContext } from "@/shared/hooks/form";

const COMMON_DEADLINES = [
  { month: 6, day: 1 }, // July 1st
  { month: 8, day: 1 }, // September 1st
  { month: 11, day: 20 }, // December 20th
];

function calculateDeadlineOptions() {
  const today = dayjs();
  const earliest = today.subtract(1, "months");
  const latest = today.add(2, "years");

  return Array.from(
    { length: latest.year() - earliest.year() + 1 },
    (_, index) => earliest.year() + index,
  )
    .flatMap((year) =>
      COMMON_DEADLINES.map(({ month, day }) =>
        dayjs().year(year).month(month).date(day).startOf("day"),
      ),
    )
    .filter((date) => !date.isBefore(earliest) && !date.isAfter(latest))
    .sort((a, b) => a.valueOf() - b.valueOf())
    .map((date) => ({
      value: date.format("YYYY-MM-DD"),
      label: date.format("DD/MM/YYYY"),
    }));
}

export default function DeadlinePickerField(props: DatePickerInputProps) {
  const field = useFieldContext<string | null>();
  return (
    <DatePickerInput
      clearable
      presets={calculateDeadlineOptions()}
      label={"Velg frist"}
      valueFormat={"DD/MM/YYYY"}
      placeholder={"DD/MM/YYYY"}
      minDate={dayjs().subtract(1, "month").toDate()}
      maxDate={dayjs().add(5, "years").toDate()}
      {...props}
      value={field.state.value}
      onChange={field.handleChange}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
