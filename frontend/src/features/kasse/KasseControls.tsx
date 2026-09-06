import { Box, Button, Flex, Stack, Text, ThemeIcon } from "@mantine/core";
import type { Icon } from "@tabler/icons-react";
import { IconSearch } from "@tabler/icons-react";

import { openSearch } from "@/features/search/openSearch";
import ScanCodeIcon from "@/shared/components/scanner/ScanCodeIcon";
import type { ScanCodeType } from "@/shared/utils/scanCodes";

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
  accepts,
  onScan,
}: {
  compact: boolean;
  icon: Icon;
  instruction: string;
  scanLabel: string;
  /** What the scan button expects; picks its icon. */
  accepts: ScanCodeType[];
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
            leftSection={<ScanCodeIcon accepts={accepts} size={18} />}
            onClick={onScan}
          >
            {scanLabel}
          </Button>
          <Button
            px="sm"
            flex={{ base: "1 1 auto", sm: "0 0 auto" }}
            variant="default"
            leftSection={<IconSearch size={18} aria-hidden />}
            onClick={openSearch}
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
        leftSection={<ScanCodeIcon accepts={accepts} size={24} />}
        onClick={onScan}
      >
        {scanLabel}
      </Button>
      <Button
        variant="subtle"
        color="gray"
        leftSection={<IconSearch size={18} aria-hidden />}
        onClick={openSearch}
      >
        Søk manuelt
      </Button>
    </Stack>
  );
}
