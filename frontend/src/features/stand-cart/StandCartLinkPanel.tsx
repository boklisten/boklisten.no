import { Button, Stack, Text } from "@mantine/core";
import { IconX } from "@tabler/icons-react";

import StandCartLinkConfirm from "@/features/stand-cart/StandCartLinkConfirm";
import type { StandCartLinking } from "@/features/stand-cart/standCartStore";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import ScannerPanel from "@/shared/components/scanner/ScannerPanel";

/**
 * The link step inside a camera modal: a sticker on no book yet turns the camera into an ISBN
 * reader, and the ISBN into a question, so the employee never leaves the modal to finish the link.
 */
export default function StandCartLinkPanel({
  cart,
  linking,
}: {
  cart: StandCart;
  linking: StandCartLinking;
}) {
  if (linking.candidate !== null) {
    return <StandCartLinkConfirm cart={cart} blid={linking.blid} title={linking.candidate.title} />;
  }

  return (
    <ScannerPanel
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
