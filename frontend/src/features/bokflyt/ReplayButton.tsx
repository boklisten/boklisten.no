import { Button, Group } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";

import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";

/** Restarts an animated figure's scene. */
export default function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <Group justify="center">
      <Button
        variant="subtle"
        size="xs"
        color={BOKFLYT_COLORS.deep}
        leftSection={<IconRefresh size={14} />}
        onClick={onClick}
      >
        Spill av igjen
      </Button>
    </Group>
  );
}
