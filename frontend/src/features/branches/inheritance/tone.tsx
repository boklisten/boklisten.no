import type { MantineColor } from "@mantine/core";
import { Switch } from "@mantine/core";

/**
 * Where a control's value comes from, in the colours of the branch manager: `own` is set at this
 * branch (an override, or the value a branch at the top of a tree hands down) and is the full
 * blue, the "this branch" colour of the Aktive bøker counts and the "Overstyrt" mark; `inherited`
 * follows the parent and is a faded blue, still clearly enabled but quieter; `plain` is a branch
 * outside any tree, where nothing is inherited, and keeps the app's own colour.
 */
export type InheritanceTone = "own" | "inherited" | "plain";

export function inheritanceTone({
  hasParent,
  overridden,
  hasChildren,
}: {
  hasParent: boolean;
  overridden: boolean;
  hasChildren: boolean;
}): InheritanceTone {
  if (hasParent) {
    return overridden ? "own" : "inherited";
  }
  return hasChildren ? "own" : "plain";
}

/**
 * The colour of a filled control (a switch that is on, a segment). Inherited is a lighter blue
 * rather than grey, because a grey filled control reads as disabled.
 */
export function toneColor(tone: InheritanceTone): MantineColor | undefined {
  if (tone === "own") {
    return "blue";
  }
  return tone === "inherited" ? INHERITED_BLUE : undefined;
}

/** The faded blue of an inherited value that is on. */
const INHERITED_BLUE: MantineColor = "blue.3";

/**
 * The text field styles for a tone: an own value gets the blue frame, an inherited one the
 * default frame with dimmed text (a tinted frame said nothing the dimmed text did not).
 */
export function toneInputStyles(tone: InheritanceTone) {
  if (tone === "own") {
    return { input: { borderColor: "var(--mantine-color-blue-light-color)" } };
  }
  return tone === "inherited" ? { input: { color: "var(--mantine-color-dimmed)" } } : undefined;
}

/**
 * A switch in its tone. On, it fills with the tone's colour; off, an own value keeps the normal
 * grey track inside a full-blue 2 px ring, the same mark as the blue frame on an own text field.
 * So "own" is always the strong blue, as the fill when on and as the frame when off, and never
 * looks like a faded "on" (a tinted track with the thumb left was too close to an inherited
 * switch that is on; a blue dot in the thumb was tried and rejected for the frame).
 */
export function ToneSwitch({
  checked,
  onChange,
  tone,
  label,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone: InheritanceTone;
  label?: string;
  ariaLabel: string;
}) {
  return (
    <Switch
      checked={checked}
      onChange={(event) => onChange(event.currentTarget.checked)}
      label={label}
      aria-label={ariaLabel}
      color={toneColor(tone)}
      styles={
        tone === "own" && !checked
          ? {
              track: {
                borderColor: "var(--mantine-color-blue-filled)",
                boxShadow: "inset 0 0 0 1px var(--mantine-color-blue-filled)",
              },
            }
          : undefined
      }
    />
  );
}
