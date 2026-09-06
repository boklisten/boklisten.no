import { Divider, Group, Kbd, Stack, Text, Title } from "@mantine/core";
import { useOs } from "@mantine/hooks";

/** The shortcuts only exist on a desktop keyboard, so the line is not rendered anywhere else. */
export default function SearchShortcutHint() {
  const os = useOs();
  const desktop = os === "macos" || os === "windows" || os === "linux";
  if (!desktop) {
    return null;
  }
  return (
    <Stack gap="lg">
      <Divider
        label={
          <Title order={2} size="xs" tt="uppercase" lts="0.08em" c="dimmed">
            Hurtigtaster
          </Title>
        }
        labelPosition="left"
      />
      <Group gap={6} wrap="wrap" c="dimmed">
        <Group gap={4} wrap="nowrap">
          <Kbd size="sm">{os === "macos" ? "⌘" : "Ctrl"}</Kbd>
          <Kbd size="sm">K</Kbd>
        </Group>
        <Text size="sm">eller</Text>
        <Group gap={4} wrap="nowrap">
          <Kbd size="sm">Shift</Kbd>
          <Kbd size="sm">Shift</Kbd>
        </Group>
        <Text size="sm">åpner søk etter kunder og bøker fra alle sider.</Text>
      </Group>
    </Stack>
  );
}
