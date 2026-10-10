import { Button } from "@mantine/core";
import { IconBasket, IconCheck, IconTrash } from "@tabler/icons-react";

import { kroner } from "@/features/cart/cartLabels";
import FloatingActionBar from "@/shared/components/FloatingActionBar";
import TanStackButton from "@/shared/components/TanStackButton";
import { bookCountLabel } from "@/shared/utils/bookCountLabel";

/**
 * The floating bar under the cart: what is due now (or, with nothing to pay, how many books), and
 * the one next step. While a book cannot be ordered the step is to remove it; while logged out the
 * step is to log in and go straight on to the checkout (which sends the customer back here if a
 * book turns out to be one they already have); otherwise the checkout, which for a cart with
 * nothing to pay is simply confirming the order.
 */
export default function CartBar({
  count,
  total,
  free,
  conflictCount,
  isLoggedIn,
  onRemoveConflicts,
}: {
  count: number;
  total: number;
  free: boolean;
  conflictCount: number;
  isLoggedIn: boolean;
  onRemoveConflicts: () => void;
}) {
  if (conflictCount > 0) {
    return (
      <FloatingActionBar
        visible
        summary={`${bookCountLabel(conflictCount)} må fjernes`}
        detail="Du kan ikke bestille en bok du allerede har eller har bestilt."
      >
        <Button
          radius="xl"
          color="orange.8"
          leftSection={<IconTrash />}
          onClick={onRemoveConflicts}
        >
          Fjern {bookCountLabel(conflictCount)}
        </Button>
      </FloatingActionBar>
    );
  }
  const summary = free ? bookCountLabel(count) : kroner(total);
  if (!isLoggedIn) {
    return (
      <FloatingActionBar visible summary={summary} detail="Logg inn for å fullføre bestillingen.">
        <TanStackButton
          to="/auth/login"
          search={{ redirect: "kasse" }}
          radius="xl"
          leftSection={free ? <IconCheck /> : <IconBasket />}
        >
          {free ? "Bekreft bestillingen" : "Gå til kassen"}
        </TanStackButton>
      </FloatingActionBar>
    );
  }
  return (
    <FloatingActionBar visible summary={summary}>
      <TanStackButton to="/kasse" radius="xl" leftSection={free ? <IconCheck /> : <IconBasket />}>
        {free ? "Bekreft bestillingen" : "Gå til kassen"}
      </TanStackButton>
    </FloatingActionBar>
  );
}
