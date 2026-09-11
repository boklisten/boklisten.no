import type { MantineColor } from "@mantine/core";
import { modals } from "@mantine/modals";
import type { ReactNode } from "react";

/**
 * Above a scanner modal rendered in a page's own tree (Mantine's default 200) and its manual
 * entry (300), below its notice dialog (400), so a question raised by a scan lands on top of the
 * camera and of a code typed by hand.
 */
export const CONFIRM_OVER_SCANNER_Z_INDEX = 320;

let openConfirms = 0;

/** Whether a confirm opened through here is still waiting for an answer. */
export function hasOpenConfirm(): boolean {
  return openConfirms > 0;
}

/**
 * Opens a confirm modal and resolves to the user's answer, so a decision can be awaited in the
 * middle of an async flow.
 */
export default function asyncConfirmModal({
  title,
  children,
  confirmLabel,
  cancelLabel = "Avbryt",
  confirmColor,
  zIndex,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmColor?: MantineColor | undefined;
  zIndex?: number | undefined;
}): Promise<boolean> {
  openConfirms += 1;
  return new Promise<boolean>((resolve) => {
    modals.openConfirmModal({
      title,
      children,
      labels: { confirm: confirmLabel, cancel: cancelLabel },
      ...(confirmColor === undefined ? {} : { confirmProps: { color: confirmColor } }),
      ...(zIndex === undefined ? {} : { zIndex }),
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
      // Dismissing via X, overlay or escape only fires onClose, so resolve there too and an awaited
      // caller can never hang. The first resolve wins.
      onClose: () => resolve(false),
    });
  }).finally(() => {
    openConfirms -= 1;
  });
}
