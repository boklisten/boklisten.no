import { createTheme, defaultVariantColorsResolver } from "@mantine/core";
import type { CSSVariablesResolver, VariantColorsResolver } from "@mantine/core";

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
    /*
     * Mantine's dark scale with the footer's blue-teal hue (202°) mixed in: each step keeps the
     * default's lightness, so contrast is unchanged, and the deep steps carry the most colour so
     * the dark canvas reads as night blue rather than black.
     */
    dark: [
      "#c2cbd1",
      "#aebac2",
      "#738691",
      "#5b6c76",
      "#344651",
      "#2c3f49",
      "#21313b",
      "#18272f",
      "#142129",
      "#0d161c",
    ],
  },
  primaryColor: "brand",
  primaryShade: 9,
  variantColorResolver,
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
