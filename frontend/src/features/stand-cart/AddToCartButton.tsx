import { lineKey } from "@boklisten/backend/shared/stand_cart";
import type { StandCartSource } from "@boklisten/backend/shared/stand_cart";
import { ActionIcon, Button } from "@mantine/core";
import { IconBasketPlus, IconBasketX } from "@tabler/icons-react";
import { useState } from "react";

import useStandCart from "@/features/stand-cart/useStandCart";
import { showErrorNotification } from "@/shared/utils/notifications";

const ADD_LABEL = "Legg i handlekurv";
const REMOVE_LABEL = "Fjern fra handlekurv";

/**
 * The one action on a book row: put it in the cart, or take it out again. The two states keep
 * distinct labels so the row always says what a click does. On a phone card the button is the
 * glyph alone, and the state is carried by the fill: light to add, filled once the book is in.
 */
export default function AddToCartButton({
  customerId,
  source,
  compact = false,
}: {
  customerId: string;
  source: StandCartSource;
  /** Glyph only, for a card where a labelled button would take a row of its own. */
  compact?: boolean;
}) {
  const cart = useStandCart(customerId);
  const [adding, setAdding] = useState(false);
  const key = lineKey(source);
  const inCart = cart.has(key);

  async function add() {
    setAdding(true);
    try {
      const notice = await cart.add(source);
      if (notice) {
        showErrorNotification({
          title: notice.title ?? "Kunne ikke legge i handlekurven",
          message: notice.message,
        });
      }
    } finally {
      setAdding(false);
    }
  }

  if (compact) {
    return inCart ? (
      <ActionIcon
        variant="filled"
        size="lg"
        aria-label={REMOVE_LABEL}
        title={REMOVE_LABEL}
        onClick={() => cart.remove(key)}
      >
        <IconBasketX size={20} aria-hidden />
      </ActionIcon>
    ) : (
      <ActionIcon
        variant="light"
        size="lg"
        aria-label={ADD_LABEL}
        title={ADD_LABEL}
        loading={adding}
        onClick={() => void add()}
      >
        <IconBasketPlus size={20} aria-hidden />
      </ActionIcon>
    );
  }

  if (inCart) {
    return (
      <Button
        variant="light"
        color="gray"
        size="compact-sm"
        leftSection={<IconBasketX size={16} aria-hidden />}
        onClick={() => cart.remove(key)}
      >
        {REMOVE_LABEL}
      </Button>
    );
  }
  return (
    <Button
      variant="light"
      size="compact-sm"
      leftSection={<IconBasketPlus size={16} aria-hidden />}
      loading={adding}
      onClick={() => void add()}
    >
      {ADD_LABEL}
    </Button>
  );
}
