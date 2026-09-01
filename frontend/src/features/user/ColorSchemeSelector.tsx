import type { MantineColorScheme } from "@mantine/core";
import { Center, Group, SegmentedControl, Stack, Text, useMantineColorScheme } from "@mantine/core";
import { IconDeviceLaptop, IconMoon, IconSun } from "@tabler/icons-react";

const OPTIONS = [
  { value: "light", label: "Lys", icon: IconSun },
  { value: "dark", label: "Mørk", icon: IconMoon },
  { value: "auto", label: "System", icon: IconDeviceLaptop },
] as const satisfies readonly { value: MantineColorScheme; label: string; icon: unknown }[];

export default function ColorSchemeSelector() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <Stack gap={6} align="center" mt="xl">
      <Text size="xs" c="dimmed">
        Utseende
      </Text>
      <SegmentedControl
        radius="xl"
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
              <Group gap={6} wrap="nowrap">
                <Icon size={16} stroke={1.6} />
                <Text size="xs">{label}</Text>
              </Group>
            </Center>
          ),
        }))}
      />
    </Stack>
  );
}
