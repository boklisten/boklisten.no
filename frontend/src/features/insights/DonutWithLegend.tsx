import { Group, Stack, Text } from "@mantine/core";
import { DonutChart } from "@mantine/charts";

export interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

/**
 * A donut chart paired with a legend that shows each segment's count and share,
 * so both the at-a-glance percentages and the raw numbers are visible.
 */
export default function DonutWithLegend({
  data,
  centerLabel,
}: {
  data: DonutSegment[];
  centerLabel?: string;
}) {
  const total = data.reduce((sum, segment) => sum + segment.value, 0);
  const share = (value: number) => (total === 0 ? 0 : Math.round((value / total) * 100));

  return (
    <Group wrap={"nowrap"} align={"center"} gap={"xl"}>
      <DonutChart
        data={total === 0 ? [{ name: "Ingen data", value: 1, color: "gray.2" }] : data}
        size={140}
        thickness={22}
        withTooltip={total > 0}
        chartLabel={centerLabel}
      />
      <Stack gap={6}>
        {data.map((segment) => (
          <Group key={segment.name} gap={"xs"} wrap={"nowrap"}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: `var(--mantine-color-${segment.color.replace(".", "-")})`,
              }}
            />
            <Text size={"sm"}>
              {segment.name}:{" "}
              <Text span fw={600}>
                {segment.value.toLocaleString("nb-NO")}
              </Text>{" "}
              <Text span c={"dimmed"}>
                ({share(segment.value)} %)
              </Text>
            </Text>
          </Group>
        ))}
      </Stack>
    </Group>
  );
}
