import { useComputedColorScheme } from "@mantine/core";
import { useEffect } from "react";

/**
 * ag-grid has its own theming system and does not follow Mantine's color scheme.
 * Mirroring the computed scheme onto the documented `data-ag-theme-mode` attribute
 * keeps the admin tables in step with the rest of the app.
 */
export default function AgGridColorSchemeSync() {
  const colorScheme = useComputedColorScheme("light");

  useEffect(() => {
    document.documentElement.dataset["agThemeMode"] = colorScheme;
  }, [colorScheme]);

  return null;
}
