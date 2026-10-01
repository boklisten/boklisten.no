/**
 * The page's palette, for props that need a colour value. These point at the CSS module's custom
 * properties, which carry the light and dark values; the fallbacks cover figures drawn outside
 * `.page` (the front page's BookFlowDiagram). Mantine accepts a `var()` as a colour and derives
 * hover and light-variant shades from it with color-mix().
 */
export const BOKFLYT_COLORS = {
  /** Accent as type, icons and outlines. */
  deep: "var(--bf-deep, #1b5a7a)",
  /** Accent as a surface: filled buttons. */
  deepFill: "var(--bf-deep-fill, #1b5a7a)",
  light: "var(--bf-light, #6fa3cf)",
  ink: "var(--bf-ink, #15303f)",
  stand: "var(--bf-stand, #8a4b3b)",
} as const;

/** Physical objects (book covers) keep one colour in both schemes. */
export const BOOK_COLORS = {
  deep: "#1b5a7a",
  light: "#6fa3cf",
} as const;
