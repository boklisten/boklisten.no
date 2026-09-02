import { IconBook2, IconSearch, IconUser } from "@tabler/icons-react";

import { KASSE_CODE_TYPES } from "@/features/kasse/codeTypes";
import { openSearchSpotlight } from "@/features/kasse/SearchSpotlight";
import KasseControls from "@/features/kasse/KasseControls";
import useCodeResolver from "@/features/kasse/useCodeResolver";
import type { CodeTargets } from "@/features/kasse/useCodeResolver";
import openScannerModal from "@/shared/components/scanner/openScannerModal";
import useWedgeScanner from "@/shared/hooks/useWedgeScanner";

/** Søk mode: scan or search for a customer or a book; a hit opens it. */
export default function SearchControls({
  compact,
  onBlid,
  onCustomer,
}: { compact: boolean } & CodeTargets) {
  const { resolveCode, resolveCodeOrNotify } = useCodeResolver({ onBlid, onCustomer });
  useWedgeScanner({ accepts: KASSE_CODE_TYPES, onScan: (code) => void resolveCodeOrNotify(code) });

  return (
    <KasseControls
      compact={compact}
      icons={[IconUser, IconBook2]}
      instruction="Skann kunde-ID eller bokas unike ID"
      onScan={() =>
        openScannerModal({
          title: "Skann kunde eller bok",
          accepts: KASSE_CODE_TYPES,
          instruction: { text: "Kunde-ID eller bokas unike ID" },
          onScan: resolveCode,
        })
      }
      secondary={{ label: "Søk manuelt", icon: IconSearch, onClick: openSearchSpotlight }}
      tips={["search", "scanner"]}
    />
  );
}
