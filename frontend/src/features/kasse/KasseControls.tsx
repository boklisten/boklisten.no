import { Box, Button, Flex, Group, Kbd, Stack, Text, ThemeIcon } from "@mantine/core";
import { useOs } from "@mantine/hooks";
import type { Icon } from "@tabler/icons-react";
import { IconBarcode, IconObjectScan } from "@tabler/icons-react";

export type DesktopTip = "search" | "scanner";

interface SecondaryAction {
  label: string;
  icon: Icon;
  onClick: () => void;
}

/**
 * Keyboard shortcuts and HID barcode scanners only exist on a desktop, so the line is not rendered
 * anywhere else. One quiet line rather than a stack of hints: it is a reminder, not instructions.
 */
function DesktopTips({ tips }: { tips: DesktopTip[] }) {
  const os = useOs();
  const desktop = os === "macos" || os === "windows" || os === "linux";
  if (!desktop || tips.length === 0) {
    return null;
  }
  const items = tips.map((tip) =>
    tip === "search" ? (
      <Group key={tip} gap={4} wrap="nowrap">
        <Kbd size="xs">{os === "macos" ? "⌘" : "Ctrl"}</Kbd>
        <Kbd size="xs">K</Kbd>
        <Text size="xs">åpner søk</Text>
      </Group>
    ) : (
      <Group key={tip} gap={4} wrap="nowrap">
        <IconBarcode size={14} aria-hidden style={{ flexShrink: 0 }} />
        <Text size="xs">Strekkodeskanner kan brukes når som helst</Text>
      </Group>
    ),
  );
  return (
    <Group gap="xs" justify="center" c="dimmed" fz="xs">
      {items.map((item, index) =>
        index === 0 ? (
          item
        ) : (
          // Below the sm breakpoint the tips stack, and a stacked line must not start with "·".
          <Group key={`sep-${index}`} gap="xs" wrap="nowrap">
            <Text size="xs" aria-hidden visibleFrom="sm">
              ·
            </Text>
            {item}
          </Group>
        ),
      )}
    </Group>
  );
}

/**
 * The two ways into a Kasse mode: the camera and a secondary manual route. Renders as a centered
 * hero while there is nothing on the page yet, and as a sticky row once there is, so the next
 * scan is always one tap away. The same shape in both modes keeps the page feeling like one tool.
 */
export default function KasseControls({
  compact,
  icons,
  instruction,
  onScan,
  secondary,
  tips,
}: {
  compact: boolean;
  /** What the hero is about: the things a scan can turn into. */
  icons: Icon[];
  instruction: string;
  onScan: () => void;
  secondary: SecondaryAction;
  tips: DesktopTip[];
}) {
  if (compact) {
    return (
      <Box
        pos="sticky"
        py="xs"
        style={{
          top: "var(--app-shell-header-offset, 0px)",
          zIndex: 10,
          backgroundColor: "var(--mantine-color-body)",
        }}
      >
        <Flex gap="xs" wrap="wrap" justify={{ base: "center", sm: "flex-start" }}>
          <Button px="sm" leftSection={<IconObjectScan size={18} aria-hidden />} onClick={onScan}>
            Skann
          </Button>
          <Button
            px="sm"
            variant="default"
            leftSection={<secondary.icon size={18} aria-hidden />}
            onClick={secondary.onClick}
          >
            {secondary.label}
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Stack align="center" gap="md" py="xl">
      <Group gap="xs">
        {icons.map((IconComponent, index) => (
          <ThemeIcon key={index} variant="light" size="xl" radius="xl">
            <IconComponent aria-hidden />
          </ThemeIcon>
        ))}
      </Group>
      <Text c="dimmed" ta="center">
        {instruction}
      </Text>
      <Button
        size="lg"
        radius="md"
        leftSection={<IconObjectScan size={24} aria-hidden />}
        onClick={onScan}
      >
        Skann
      </Button>
      <Button
        variant="subtle"
        color="gray"
        leftSection={<secondary.icon size={18} aria-hidden />}
        onClick={secondary.onClick}
      >
        {secondary.label}
      </Button>
      <DesktopTips tips={tips} />
    </Stack>
  );
}
