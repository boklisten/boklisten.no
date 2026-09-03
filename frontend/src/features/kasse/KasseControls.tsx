import { Box, Button, Flex, Group, Kbd, Stack, Text, ThemeIcon } from "@mantine/core";
import { useOs } from "@mantine/hooks";
import type { Icon } from "@tabler/icons-react";
import { IconObjectScan, IconSearch } from "@tabler/icons-react";

import { openSearchSpotlight } from "@/features/kasse/SearchSpotlight";

/** The shortcut only exists on a desktop keyboard, so the line is not rendered anywhere else. */
function DesktopTip() {
  const os = useOs();
  const desktop = os === "macos" || os === "windows" || os === "linux";
  if (!desktop) {
    return null;
  }
  return (
    <Group gap={4} justify="center" wrap="nowrap" c="dimmed">
      <Kbd size="xs">{os === "macos" ? "⌘" : "Ctrl"}</Kbd>
      <Kbd size="xs">K</Kbd>
      <Text size="xs">åpner søk når som helst, også mens en kunde eller bok er åpen</Text>
    </Group>
  );
}

/**
 * The two ways into the Kasse: the camera and the manual search. Renders as a centered hero while
 * there is nothing on the page yet, and as a sticky row once there is, so the next scan is always
 * one tap away. The same shape in every mode keeps the page feeling like one tool.
 */
export default function KasseControls({
  compact,
  icon: IconComponent,
  instruction,
  scanLabel,
  onScan,
}: {
  compact: boolean;
  icon: Icon;
  instruction: string;
  scanLabel: string;
  onScan: () => void;
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
          <Button
            px="sm"
            flex={{ base: "1 1 auto", sm: "0 0 auto" }}
            leftSection={<IconObjectScan size={18} aria-hidden />}
            onClick={onScan}
          >
            {scanLabel}
          </Button>
          <Button
            px="sm"
            flex={{ base: "1 1 auto", sm: "0 0 auto" }}
            variant="default"
            leftSection={<IconSearch size={18} aria-hidden />}
            onClick={openSearchSpotlight}
          >
            Søk manuelt
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Stack align="center" gap="md" py="xl">
      <ThemeIcon variant="light" size="xl" radius="xl">
        <IconComponent aria-hidden />
      </ThemeIcon>
      <Text c="dimmed" ta="center" maw={420}>
        {instruction}
      </Text>
      <Button
        size="lg"
        radius="md"
        leftSection={<IconObjectScan size={24} aria-hidden />}
        onClick={onScan}
      >
        {scanLabel}
      </Button>
      <Button
        variant="subtle"
        color="gray"
        leftSection={<IconSearch size={18} aria-hidden />}
        onClick={openSearchSpotlight}
      >
        Søk manuelt
      </Button>
      <DesktopTip />
    </Stack>
  );
}
