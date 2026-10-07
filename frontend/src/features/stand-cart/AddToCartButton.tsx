import { lineKey } from "@boklisten/backend/shared/stand_cart";
import type { StandCartSource } from "@boklisten/backend/shared/stand_cart";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconBasketPlus, IconBasketX } from "@tabler/icons-react";
import { useState } from "react";

import useStandCart from "@/features/stand-cart/useStandCart";
import { showErrorNotification } from "@/shared/utils/notifications";

const ADD_LABEL = "Legg i handlekurv";
const REMOVE_LABEL = "Fjern fra handlekurv";

/**
 * The one action on a book row: put it in the cart, or take it out again. An icon button, so the
 * row keeps its width for the title; the tooltip and the accessible name say what a click does,
 * and the fill carries the state: light to add, filled once the book is in.
 */
export default function AddToCartButton({
  customerId,
  source,
  exceptionLabel,
}: {
  customerId: string;
  source: StandCartSource;
  /**
   * The book is not meant to go out from the stand (another student hands it over): the button
   * is drawn muted and named by this label. The cart itself asks before such a book goes in,
   * however it is added.
   */
  exceptionLabel?: string;
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

  if (inCart) {
    return (
      <Tooltip label={REMOVE_LABEL}>
        <ActionIcon
          variant="filled"
          size="lg"
          aria-label={REMOVE_LABEL}
          onClick={() => cart.remove(key)}
        >
          <IconBasketX size={20} aria-hidden />
        </ActionIcon>
      </Tooltip>
    );
  }
  const label = exceptionLabel ?? ADD_LABEL;
  return (
    <Tooltip label={label}>
      <ActionIcon
        // Muted, so it never reads as the stand's own "add" on a book a student is to bring
        variant={exceptionLabel ? "subtle" : "light"}
        color={exceptionLabel ? "gray" : undefined}
        size="lg"
        aria-label={label}
        loading={adding}
        onClick={() => void add()}
      >
        <IconBasketPlus size={20} aria-hidden />
      </ActionIcon>
    </Tooltip>
  );
}
