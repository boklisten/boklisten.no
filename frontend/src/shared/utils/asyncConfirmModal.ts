import type { MantineColor } from "@mantine/core";
import { modals } from "@mantine/modals";
import type { ReactNode } from "react";

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
  return new Promise((resolve) => {
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
  });
}
