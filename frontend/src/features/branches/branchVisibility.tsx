import type { BranchVisibility } from "@boklisten/backend/shared/branch-visibility";
import { Center, Group } from "@mantine/core";
import { IconShieldStar, IconUserCog, IconWorld } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";

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

export function visibilityDescription(visibility: BranchVisibility): string {
  return VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.description ?? "";
}
