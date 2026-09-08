import { Button, Stack, Text } from "@mantine/core";
import { IconX } from "@tabler/icons-react";

import StandCartLinkConfirm from "@/features/stand-cart/StandCartLinkConfirm";
import useStandCart from "@/features/stand-cart/useStandCart";
import ScannerPanel from "@/shared/components/scanner/ScannerPanel";

/**
 * What the «Skann bøker» modal shows. Normally just the camera reading stickers into the cart; the
 * list of what to scan stays on the page behind it. A sticker on no book yet turns the same camera
 * into an ISBN reader, and the ISBN into a question, so the employee never leaves the modal to
 * finish the link. Reads the cart store live, since the modal lives outside the page's tree.
 */
export default function StandCartScanner({
  customerId,
  orderId,
}: {
  customerId: string;
  /** Only copies on this order may enter the cart. */
  orderId?: string;
}) {
  const cart = useStandCart(customerId, orderId === undefined ? undefined : { orderId });
  const linking = cart.cart.linking?.via === "camera" ? cart.cart.linking : null;

  if (linking === null) {
    return (
      <ScannerPanel
        key="blid"
        allowManualEntry
        accepts={["blid"]}
        instruction={{ text: "Bokas unike ID", illustrate: "blid" }}
        onScan={(blid) => cart.addBlid(blid, "camera")}
      />
    );
  }

  if (linking.candidate !== null) {
    return <StandCartLinkConfirm cart={cart} blid={linking.blid} title={linking.candidate.title} />;
  }

  return (
    <ScannerPanel
      key="isbn"
      allowManualEntry
      accepts={["isbn"]}
      instruction={{
        text: `Skann ISBN-en for å koble unik ID ${linking.blid}`,
        illustrate: "isbn",
      }}
      onScan={cart.proposeLink}
    >
      <Stack gap="xs">
        <Text size="sm">
          Unik ID{" "}
          <Text span fw={700}>
            {linking.blid}
          </Text>{" "}
          er ikke koblet til noen bok. Skann ISBN-en på boka for å koble den.
        </Text>
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconX size={16} aria-hidden />}
          style={{ alignSelf: "flex-start" }}
          onClick={() => cart.cancelLink("camera")}
        >
          Avbryt kobling
        </Button>
      </Stack>
    </ScannerPanel>
  );
}
