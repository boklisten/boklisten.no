import { Kbd, Text } from "@mantine/core";
import { useOs } from "@mantine/hooks";

/**
 * One quiet line on how to open search from the keyboard. The shortcuts only exist on a desktop
 * keyboard, so the line is for desktop operating systems and, like the sidebar, for windows from
 * `sm` up; narrower than that the page is the phone layout, whichever device shows it.
 */
export default function SearchShortcutHint() {
  const os = useOs();
  const desktop = os === "macos" || os === "windows" || os === "linux";
  if (!desktop) {
    return null;
  }
  return (
    <Text size="sm" c="dimmed" ta="center" maw="46ch" lh={2} visibleFrom="sm">
      <Kbd size="sm">{os === "macos" ? "⌘" : "Ctrl"}</Kbd> <Kbd size="sm">K</Kbd> eller{" "}
      <Kbd size="sm">Shift</Kbd> <Kbd size="sm">Shift</Kbd> åpner søket fra alle sider.
    </Text>
  );
}
