import { Text } from "@mantine/core";

import asyncConfirmModal, { CONFIRM_OVER_SCANNER_Z_INDEX } from "@/shared/utils/asyncConfirmModal";

/**
 * A book is about to go into the cart although another student is to hand it to the customer at
 * an overlevering. The stand only steps in when that falls through (a no-show), so it asks.
 */
export default function confirmPeerHandout({
  title,
  peerName,
}: {
  title: string;
  peerName: string;
}): Promise<boolean> {
  return asyncConfirmModal({
    title: "Dele ut fra stand?",
    children: (
      <Text size="sm">
        «{title}» skal kunden få av {peerName} på en overlevering. Del den bare ut fra stand hvis
        overleveringen ikke blir noe av.
      </Text>
    ),
    confirmLabel: "Legg i handlekurv",
    zIndex: CONFIRM_OVER_SCANNER_Z_INDEX,
  });
}
