import type { Icon } from "@tabler/icons-react";
import { IconBook2, IconPackageImport, IconUser } from "@tabler/icons-react";

import type { ScanInstruction } from "@/shared/components/scanner/ScanInstructionOverlay";
import type { ScanCodeType } from "@/shared/utils/scanCodes";

export const KASSE_MODES = ["kunde", "boksok", "innsamling"] as const;
export type KasseMode = (typeof KASSE_MODES)[number];

export interface KasseModeConfig {
  label: string;
  icon: Icon;
  /** One sentence that says what to scan and what happens; doubles as the hero instruction. */
  description: string;
  /** The scan button, in both the hero and the sticky row. */
  scanLabel: string;
  /** What every scanner on the page (camera, physical scanner, manual entry) lets through. */
  accepts: ScanCodeType[];
  /** What the manual search looks for. */
  search: "customers" | "books";
  scanner: {
    title: string;
    instruction: ScanInstruction;
    /** Keep the camera modal open between scans. */
    keepOpen: boolean;
  };
}

/**
 * The mode says what the next scan does, like the check-out/check-in modes of a library desk. Each
 * mode takes exactly one kind of code; anything else is rejected with a notice by the scanner.
 */
export const KASSE_MODE_CONFIG: Record<KasseMode, KasseModeConfig> = {
  kunde: {
    label: "Kunde",
    icon: IconUser,
    description: "Skann kunde-ID for å se kundens bestillinger og bøker.",
    scanLabel: "Skann kunde-ID",
    accepts: ["customerId"],
    search: "customers",
    scanner: {
      title: "Skann kunde-ID",
      instruction: { text: "Kunde-ID", illustrate: "customerId" },
      keepOpen: false,
    },
  },
  boksok: {
    label: "Boksøk",
    icon: IconBook2,
    description: "Skann bokas unike ID for å se hvem som har boka og hva som har skjedd med den.",
    scanLabel: "Skann bokas unike ID",
    accepts: ["blid"],
    search: "books",
    scanner: {
      title: "Skann bok",
      instruction: { text: "Bokas unike ID", illustrate: "blid" },
      keepOpen: false,
    },
  },
  innsamling: {
    label: "Innsamling",
    icon: IconPackageImport,
    description: "Skann flere bøker etter hverandre og lever dem inn samlet.",
    scanLabel: "Skann bøker",
    accepts: ["blid"],
    search: "books",
    scanner: {
      title: "Skann bøker som leveres inn",
      instruction: { text: "Bokas unike ID", illustrate: "blid" },
      keepOpen: true,
    },
  },
};
