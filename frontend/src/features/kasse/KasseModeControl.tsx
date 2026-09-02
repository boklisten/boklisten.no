import { Center, SegmentedControl } from "@mantine/core";
import { IconPackageImport, IconSearch } from "@tabler/icons-react";
import type { ReactNode } from "react";

export const KASSE_MODES = ["sok", "innsamling"] as const;
export type KasseMode = (typeof KASSE_MODES)[number];

function ModeLabel({ icon, children }: { icon: ReactNode; children: string }) {
  return (
    <Center style={{ gap: 6 }}>
      {icon}
      <span>{children}</span>
    </Center>
  );
}

/** Søk looks a customer or book up; Samle inn stacks scanned books for one return delivery. */
export default function KasseModeControl({
  value,
  onChange,
}: {
  value: KasseMode;
  onChange: (mode: KasseMode) => void;
}) {
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next === "innsamling" ? "innsamling" : "sok")}
      w={{ base: "100%", xs: "auto" }}
      data={[
        {
          value: "sok",
          label: <ModeLabel icon={<IconSearch size={16} aria-hidden />}>Søk</ModeLabel>,
        },
        {
          value: "innsamling",
          label: (
            <ModeLabel icon={<IconPackageImport size={16} aria-hidden />}>Samle inn</ModeLabel>
          ),
        },
      ]}
    />
  );
}
