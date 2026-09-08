import { Modal, Stack, Text } from "@mantine/core";

import StandCartLinkConfirm from "@/features/stand-cart/StandCartLinkConfirm";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import ScanPrompt from "@/shared/components/scanner/ScanPrompt";

// Above the Kasse scanner modal (200), should the camera be open when the barcode reader is used
const LINK_Z_INDEX = 350;

/**
 * The sticker is read, the book is not: the reader now has to read the ISBN off the book. The
 * modal's close cross is the way out.
 */
function IsbnPrompt({ blid }: { blid: string }) {
  return (
    <Stack>
      <Text>
        Unik ID{" "}
        <Text span fw={700}>
          {blid}
        </Text>{" "}
        er ikke koblet til noen bok.
      </Text>
      <ScanPrompt type="isbn">Skann bokas ISBN</ScanPrompt>
    </Stack>
  );
}

/**
 * The link step for a sticker the physical barcode reader scanned: the reader can read the ISBN
 * too, so no camera and no typing. The page's own reader listener routes the ISBN here while the
 * modal is open.
 */
export default function StandCartLinkModal({ cart }: { cart: StandCart }) {
  const linking = cart.cart.linking?.via === "wedge" ? cart.cart.linking : null;

  return (
    <Modal
      opened={linking !== null}
      onClose={() => cart.cancelLink("wedge")}
      title="Koble unik ID til bok"
      zIndex={LINK_Z_INDEX}
    >
      {linking !== null &&
        (linking.candidate === null ? (
          <IsbnPrompt blid={linking.blid} />
        ) : (
          <StandCartLinkConfirm cart={cart} blid={linking.blid} title={linking.candidate.title} />
        ))}
    </Modal>
  );
}
