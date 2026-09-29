import type { BranchVisibility } from "@boklisten/backend/shared/branch-visibility";
import { Center, Group, Select } from "@mantine/core";
import { IconShieldStar, IconUserCog, IconWorld } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";

import { toneInputStyles } from "@/features/branches/inheritance/tone";
import type { InheritanceTone } from "@/features/branches/inheritance/tone";

const VISIBILITY_OPTIONS: {
  value: BranchVisibility;
  label: string;
  icon: Icon;
  description: string;
}[] = [
  {
    value: "public",
    label: "Offentlig",
    icon: IconWorld,
    description: "Vises for alle. Kunder kan bestille herfra når filialen har fag med bøker.",
  },
  {
    value: "employee",
    label: "Ansatte",
    icon: IconUserCog,
    description: "Vises bare for ansatte og administratorer. Kunder kan ikke bestille herfra.",
  },
  {
    value: "admin",
    label: "Admin",
    icon: IconShieldStar,
    description: "Vises bare for administratorer. Kunder kan ikke bestille herfra.",
  },
];

/** The segments of the Synlighet control: icon and label, like the permission levels. */
export const VISIBILITY_SEGMENTS = VISIBILITY_OPTIONS.map(
  ({ value, label, icon: SegmentIcon }) => ({
    value,
    label: (
      <Center>
        <Group gap={6} wrap="nowrap">
          <SegmentIcon size={16} />
          <span>{label}</span>
        </Group>
      </Center>
    ),
  }),
);

/**
 * A compact visibility picker for places a segmented control does not fit, e.g. a row in the
 * descendant tree: the same icons and labels as `VISIBILITY_SEGMENTS`.
 */
export function VisibilitySelect({
  value,
  onChange,
  label,
  tone,
}: {
  value: BranchVisibility;
  onChange: (visibility: BranchVisibility) => void;
  /** The accessible name, e.g. "Synlighet for Ullern VG1". */
  label: string;
  tone: InheritanceTone;
}) {
  const current = VISIBILITY_OPTIONS.find((option) => option.value === value);
  const CurrentIcon = current?.icon;
  return (
    <Select
      size="xs"
      w={132}
      aria-label={label}
      // The value is chosen, not typed: the icon opens the dropdown like the text, and a double
      // click must not select the text (browsers ignore `user-select` on inputs, so the second
      // mousedown is cancelled instead; the first one still opens the dropdown).
      leftSectionPointerEvents="none"
      onMouseDown={(event) => {
        if (event.detail > 1) {
          event.preventDefault();
        }
      }}
      styles={toneInputStyles(tone)}
      allowDeselect={false}
      data={VISIBILITY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
      value={value}
      onChange={(next) => {
        const option = VISIBILITY_OPTIONS.find((candidate) => candidate.value === next);
        if (option) {
          onChange(option.value);
        }
      }}
      leftSection={CurrentIcon ? <CurrentIcon size={14} /> : undefined}
      renderOption={({ option }) => {
        const OptionIcon = VISIBILITY_OPTIONS.find(
          (candidate) => candidate.value === option.value,
        )?.icon;
        return (
          <Group gap={6} wrap="nowrap">
            {OptionIcon && <OptionIcon size={14} />}
            <span>{option.label}</span>
          </Group>
        );
      }}
    />
  );
}

/** The segment text of a visibility, e.g. "Offentlig". */
export function visibilityLabel(visibility: BranchVisibility): string {
  return VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ?? visibility;
}

export function visibilityDescription(visibility: BranchVisibility): string {
  return VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.description ?? "";
}
