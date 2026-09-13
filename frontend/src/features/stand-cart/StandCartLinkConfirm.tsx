import { Button, Group, Stack, Text } from "@mantine/core";
import { useState } from "react";

import BookLinkFigure from "@/features/book-cover/BookLinkFigure";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import { BOOK_EVENT_APPEARANCE } from "@/shared/components/bookEventAppearance";
import { showErrorNotification } from "@/shared/utils/notifications";

// The icons of the history entries each button leads to.
const LinkIcon = BOOK_EVENT_APPEARANCE.registered.icon;
const SwapIcon = BOOK_EVENT_APPEARANCE.edited.icon;

/** The last step of a link, the same in both scanners: the book the ISBN resolved to, and the employee's yes. */
export default function StandCartLinkConfirm({
  cart,
  blid,
  book,
}: {
  cart: StandCart;
  blid: string;
  book: { title: string; isbn: string };
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
      <BookLinkFigure blid={blid} isbn={book.isbn} title={book.title} />
      <Text>Er dette riktig?</Text>
      <Group>
        <Button
          leftSection={<LinkIcon size={18} aria-hidden />}
          loading={confirming}
          onClick={() => void confirm()}
          data-autofocus
        >
          Koble til
        </Button>
        <Button
          variant="default"
          leftSection={<SwapIcon size={18} aria-hidden />}
          disabled={confirming}
          onClick={cart.retryLink}
        >
          Bytt bok
        </Button>
      </Group>
    </Stack>
  );
}
