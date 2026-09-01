import { createTheme } from "@mantine/core";
import type { CSSVariablesResolver } from "@mantine/core";

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
