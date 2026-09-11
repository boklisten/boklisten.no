import { Box } from "@mantine/core";
import type { ReactNode } from "react";

/**
 * Keeps a page's working controls in view while the employee scrolls through what is below them:
 * the scan buttons, and the bar for a list that waits. Sits under the app header and paints the
 * page background so rows slide beneath it.
 */
export default function StickyToolbar({ children }: { children: ReactNode }) {
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
      {children}
    </Box>
  );
}
