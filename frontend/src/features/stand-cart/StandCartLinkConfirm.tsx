import { Button, Group, Stack, Text } from "@mantine/core";
import { useState } from "react";

import type { StandCart } from "@/features/stand-cart/useStandCart";
import { showErrorNotification } from "@/shared/utils/notifications";

/**
 * The last step of a link, the same in both scanners: the title the ISBN resolved to, and the
 * employee's yes before the sticker is bound to it for good.
 */
export default function StandCartLinkConfirm({
  cart,
  blid,
  title,
}: {
  cart: StandCart;
  blid: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);

  async function confirm() {
    setConfirming(true);
    try {
      const notice = await cart.confirmLink();
      if (notice) {
        showErrorNotification({
          title: notice.title ?? "Kunne ikke koble",
          message: notice.message,
        });
      }
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Stack>
      <Text>
        Unik ID{" "}
        <Text span fw={700}>
          {blid}
        </Text>{" "}
        blir koblet til{" "}
        <Text span fw={700}>
          «{title}»
        </Text>
        . Er dette riktig?
      </Text>
      <Group>
        <Button loading={confirming} onClick={() => void confirm()} data-autofocus>
          Koble til
        </Button>
        <Button variant="default" disabled={confirming} onClick={cart.retryLink}>
          Skann på nytt
        </Button>
      </Group>
    </Stack>
  );
}
