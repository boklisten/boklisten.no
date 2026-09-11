import { useCallback, useState } from "react";

import type { ScanNotice } from "@/shared/components/scanner/ScannerPanel";
import useWedgeScanner from "@/shared/hooks/useWedgeScanner";
import { hasOpenConfirm } from "@/shared/utils/asyncConfirmModal";
import { showErrorNotification } from "@/shared/utils/notifications";
import type { ScanCodeType } from "@/shared/utils/scanCodes";
import { describeRejectedScan, determineScanCodeType } from "@/shared/utils/scanCodes";

/** How a code reached the page. */
export type CodeSource = "camera" | "wedge" | "search";

/** Handles a code. May return a notice when it led nowhere. */
export type CodeHandler = (
  code: string,
  via: CodeSource,
) => Promise<ScanNotice | undefined> | ScanNotice | undefined | void;

/** One way a code reaches the page: what it lets through and what happens to it. */
export interface CodeChannel {
  accepts: ScanCodeType[];
  onCode: CodeHandler;
}

/** For inputs without a notice UI of their own: the physical scanner and the spotlight. */
async function submitCode(channel: CodeChannel, code: string, via: CodeSource): Promise<void> {
  // A question is on screen; the answer comes first, a scan meanwhile is not an answer.
  if (hasOpenConfirm()) {
    return;
  }
  const type = determineScanCodeType(code);
  const notice = channel.accepts.includes(type)
    ? await channel.onCode(code, via)
    : describeRejectedScan(type, channel.accepts);
  if (notice) {
    showErrorNotification({ title: notice.title, message: notice.message });
  }
}

/**
 * Every way a code reaches the Kasse page — the camera modal and its manual entry, the physical
 * barcode scanner and the search spotlight — funnels through the page's one router, so a code
 * behaves the same no matter how it arrived. The camera is a modal in the page's own tree
 * (KasseScannerModal), so it stays mounted while a question is asked on top of it and always
 * sees the open view; this hook only holds whether it is open. The physical scanner can only read
 * barcodes, so it gets its own channel.
 */
export default function useKasseScanner(camera: CodeChannel, wedge: CodeChannel) {
  const [opened, setOpened] = useState(false);

  useWedgeScanner({
    accepts: wedge.accepts,
    onScan: (code) => void submitCode(wedge, code, "wedge"),
  });

  return {
    opened,
    openScanner: useCallback(() => setOpened(true), []),
    closeScanner: useCallback(() => setOpened(false), []),
    submitCode: (code: string) => submitCode(camera, code, "search"),
  };
}
