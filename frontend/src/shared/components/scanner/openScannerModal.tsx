import { modals } from "@mantine/modals";

import ScannerPanel from "@/shared/components/scanner/ScannerPanel";
import type { ScannerPanelProps } from "@/shared/components/scanner/ScannerPanel";

const SCANNER_MODAL_ID = "scanner";

export default function openScannerModal({
  title,
  ...panelProps
}: { title: string } & ScannerPanelProps) {
  modals.open({
    modalId: SCANNER_MODAL_ID,
    title,
    children: (
      <ScannerPanel
        {...panelProps}
        onSuccess={() => {
          panelProps.onSuccess?.();
          modals.close(SCANNER_MODAL_ID);
        }}
      />
    ),
  });
}
