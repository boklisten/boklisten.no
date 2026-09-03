import { Center, InputLabel, SegmentedControl, Stack } from "@mantine/core";
import { useId } from "react";

import { KASSE_MODES, KASSE_MODE_CONFIG } from "@/features/kasse/kasseModes";
import type { KasseMode } from "@/features/kasse/kasseModes";

/** One tap switches what the next scan does. The hero below explains the chosen mode. */
export default function KasseModeControl({
  value,
  onChange,
}: {
  value: KasseMode;
  onChange: (mode: KasseMode) => void;
}) {
  const labelId = useId();
  return (
    <Stack gap={4}>
      <InputLabel id={labelId}>Modus</InputLabel>
      <SegmentedControl
        aria-labelledby={labelId}
        value={value}
        onChange={(next) => onChange(KASSE_MODES.find((mode) => mode === next) ?? "kunde")}
        data={KASSE_MODES.map((mode) => {
          const { label, icon: IconComponent } = KASSE_MODE_CONFIG[mode];
          return {
            value: mode,
            label: (
              <Center style={{ gap: 6 }}>
                <IconComponent size={16} aria-hidden />
                <span>{label}</span>
              </Center>
            ),
          };
        })}
      />
    </Stack>
  );
}
