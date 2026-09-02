import { modals } from "@mantine/modals";

import ScannerPanel from "@/shared/components/scanner/ScannerPanel";
import type { ScannerPanelProps } from "@/shared/components/scanner/ScannerPanel";

const SCANNER_MODAL_ID = "scanner";

export function closeScannerModal() {
  modals.close(SCANNER_MODAL_ID);
}

/**
 * Opens the camera in a modal. By default a successful scan closes it; pass `keepOpen` for flows
 * that take one code after another (bulk collection), where closing after every hit would cost a
 * tap per book.
 */
export default function openScannerModal({
  title,
  keepOpen = false,
  ...panelProps
}: { title: string; keepOpen?: boolean } & ScannerPanelProps) {
  modals.open({
    modalId: SCANNER_MODAL_ID,
    title,
    children: (
      <ScannerPanel
        {...panelProps}
        onSuccess={() => {
          panelProps.onSuccess?.();
          if (!keepOpen) {
            closeScannerModal();
          }
        }}
      />
    ),
  });
}
