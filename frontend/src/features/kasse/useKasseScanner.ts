import type { KasseModeConfig } from "@/features/kasse/kasseModes";
import type { ScanNotice } from "@/shared/components/scanner/ScannerPanel";
import openScannerModal from "@/shared/components/scanner/openScannerModal";
import useWedgeScanner from "@/shared/hooks/useWedgeScanner";
import { showErrorNotification } from "@/shared/utils/notifications";
import type { ScanCodeType } from "@/shared/utils/scanCodes";
import { describeRejectedScan, determineScanCodeType } from "@/shared/utils/scanCodes";

/** Handles a code of the mode's type. May return a notice when it led nowhere. */
export type CodeHandler = (
  code: string,
) => Promise<ScanNotice | undefined> | ScanNotice | undefined | void;

/** One way a code reaches the page: what it lets through and what happens to it. */
export interface CodeChannel {
  accepts: ScanCodeType[];
  onCode: CodeHandler;
}

/** Resolves the code, returning a notice for the caller to display when it led nowhere. */
async function resolveCode(channel: CodeChannel, code: string): Promise<ScanNotice | undefined> {
  const type = determineScanCodeType(code);
  if (!channel.accepts.includes(type)) {
    return describeRejectedScan(type, channel.accepts);
  }
  return (await channel.onCode(code)) ?? undefined;
}

/** For inputs without a notice UI of their own: the physical scanner and the spotlight. */
async function submitCode(channel: CodeChannel, code: string): Promise<void> {
  const notice = await resolveCode(channel, code);
  if (notice) {
    showErrorNotification({ title: notice.title, message: notice.message });
  }
}

/**
 * Every way a code reaches the Kasse page — camera modal, its manual entry, the physical barcode
 * scanner and the search spotlight — funnels through here, so a code behaves the same no matter
 * how it arrived. The config decides which kinds of code the camera lets through and how it
 * presents itself; anything else gets the scanner's standard rejection notice. The physical
 * scanner can only read barcodes, so a mode may give it its own channel where the camera's
 * would reject everything it can produce.
 */
export default function useKasseScanner(
  config: KasseModeConfig,
  onCode: CodeHandler,
  wedge?: CodeChannel,
) {
  const camera: CodeChannel = { accepts: config.accepts, onCode };
  const wedgeChannel = wedge ?? camera;

  useWedgeScanner({
    accepts: wedgeChannel.accepts,
    onScan: (code) => void submitCode(wedgeChannel, code),
  });

  const openScanner = () =>
    openScannerModal({
      ...config.scanner,
      accepts: config.accepts,
      onScan: (code) => resolveCode(camera, code),
    });

  return { openScanner, submitCode: (code: string) => submitCode(camera, code) };
}
