import type { MantineColorScheme } from "@mantine/core";
import { Center, Group, SegmentedControl, Text, useMantineColorScheme } from "@mantine/core";
import { IconDeviceLaptop, IconMoon, IconSun } from "@tabler/icons-react";

const OPTIONS = [
  { value: "light", label: "Lys", icon: IconSun },
  { value: "dark", label: "Mørk", icon: IconMoon },
  { value: "auto", label: "System", icon: IconDeviceLaptop },
] as const satisfies readonly { value: MantineColorScheme; label: string; icon: unknown }[];

/**
 * Lys / Mørk / System as one pill. Named "Utseende" for assistive tech unless a visible label is
 * given through `labelledBy`. Stretched, it fills a column (the head of the bl-admin menu). Compact where the column is narrow
 * (the sidebar): smaller type and icons, so the three words still fit.
 */
export default function ColorSchemeSelector({
  fullWidth = false,
  compact = false,
  labelledBy,
}: {
  fullWidth?: boolean;
  compact?: boolean;
  /** The id of a visible label; replaces the built-in accessible name. */
  labelledBy?: string;
}) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <SegmentedControl
      aria-label={labelledBy ? undefined : "Utseende"}
      aria-labelledby={labelledBy}
      radius="xl"
      fullWidth={fullWidth}
      size={compact ? "xs" : "sm"}
      value={colorScheme}
      onChange={(value) => {
        const scheme = OPTIONS.find((option) => option.value === value)?.value;
        if (scheme) {
          setColorScheme(scheme);
        }
      }}
      data={OPTIONS.map(({ value, label, icon: Icon }) => ({
        value,
        label: (
          <Center>
            <Group gap={compact ? 4 : 6} wrap="nowrap">
              <Icon size={compact ? 13 : 16} stroke={1.6} aria-hidden />
              <Text size="xs" fz={compact ? 11 : undefined}>
                {label}
              </Text>
            </Group>
          </Center>
        ),
      }))}
    />
  );
}
