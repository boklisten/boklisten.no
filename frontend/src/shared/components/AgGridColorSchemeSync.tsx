import { useComputedColorScheme } from "@mantine/core";
import { provideGlobalGridOptions, themeQuartz } from "ag-grid-community";
import { useEffect } from "react";

/*
 * Quartz's own dark mode paints a neutral grey that sits apart from Mantine's night-blue dark
 * scale. In dark mode the grid takes Mantine's surfaces instead, so a table reads as part of the
 * page; Quartz mixes the header, hover and menu shades from these. Registered at import, as the
 * grids are rendered under the admin layout that mounts this component.
 */
provideGlobalGridOptions({
  theme: themeQuartz.withParams(
    {
      backgroundColor: "var(--mantine-color-body)",
      foregroundColor: "var(--mantine-color-text)",
      borderColor: "var(--mantine-color-default-border)",
      accentColor: "var(--mantine-color-brand-text)",
    },
    "dark",
  ),
});

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
