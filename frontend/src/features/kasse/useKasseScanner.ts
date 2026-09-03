import { KASSE_MODE_CONFIG } from "@/features/kasse/kasseModes";
import type { KasseMode } from "@/features/kasse/kasseModes";
import type { ScanNotice } from "@/shared/components/scanner/ScannerPanel";
import openScannerModal from "@/shared/components/scanner/openScannerModal";
import useWedgeScanner from "@/shared/hooks/useWedgeScanner";
import { showErrorNotification } from "@/shared/utils/notifications";
import { describeRejectedScan, determineScanCodeType } from "@/shared/utils/scanCodes";

/** Handles a code of the mode's type. May return a notice when it led nowhere. */
export type CodeHandler = (
  code: string,
) => Promise<ScanNotice | undefined> | ScanNotice | undefined | void;

/**
 * Every way a code reaches the Kasse page — camera modal, its manual entry, the physical barcode
 * scanner and the search spotlight — funnels through here, so a code behaves the same no matter
 * how it arrived. The mode decides which kind of code is let through and how the camera presents
 * itself; anything else gets the scanner's standard rejection notice.
 */
export default function useKasseScanner(mode: KasseMode, onCode: CodeHandler) {
  const config = KASSE_MODE_CONFIG[mode];

  /** Resolves the code, returning a notice for the caller to display when it led nowhere. */
  async function resolveCode(code: string): Promise<ScanNotice | undefined> {
    const type = determineScanCodeType(code);
    if (!config.accepts.includes(type)) {
      return describeRejectedScan(type, config.accepts);
    }
    return (await onCode(code)) ?? undefined;
  }

  /** For inputs without a notice UI of their own: the physical scanner and the spotlight. */
  async function submitCode(code: string): Promise<void> {
    const notice = await resolveCode(code);
    if (notice) {
      showErrorNotification({ title: notice.title, message: notice.message });
    }
  }

  useWedgeScanner({ accepts: config.accepts, onScan: (code) => void submitCode(code) });

  const openScanner = () =>
    openScannerModal({ ...config.scanner, accepts: config.accepts, onScan: resolveCode });

  return { openScanner, submitCode };
}
