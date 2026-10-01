import { createTheme, defaultVariantColorsResolver, Tabs } from "@mantine/core";
import type { CSSVariablesResolver, VariantColorsResolver } from "@mantine/core";

import tabsClasses from "@/styles/Tabs.module.css";

/**
 * Mantine keeps the white variant white on hover, so without an underline it gives no hint at all.
 * It only ever sits on a coloured surface (the teal hero), where a pale brand tint reads as hover.
 */
const variantColorResolver: VariantColorsResolver = (input) => {
  const colors = defaultVariantColorsResolver(input);
  if (input.variant === "white") {
    return { ...colors, hover: "var(--mantine-color-brand-1)" };
  }
  return colors;
};

const theme = createTheme({
  colors: {
    brand: [
      "#eff8fb",
      "#e0edf1",
      "#bbdae4",
      "#94c7d8",
      "#75b7cd",
      "#62adc6",
      "#56a8c4",
      "#4693ad",
      "#3a829b",
      "#26768f",
    ],
  },
  primaryColor: "brand",
  primaryShade: 9,
  variantColorResolver,
  components: {
    // The current tab is marked like the current page in the navigation: the yellow highlighter.
    Tabs: Tabs.extend({ classNames: tabsClasses }),
  },
});

export const cssVariablesResolver: CSSVariablesResolver = (mantineTheme) => ({
  variables: {},
  light: {},
  dark: Object.fromEntries(
    Object.keys(mantineTheme.colors).map((color) => [
      `--mantine-color-${color}-light-color`,
      `var(--mantine-color-${color}-text)`,
    ]),
  ),
});

export default theme;
