import { Button } from "@mantine/core";
import { IconBasket, IconCheck, IconLogin2, IconTrash } from "@tabler/icons-react";

import { kroner } from "@/features/cart/cartLabels";
import FloatingActionBar from "@/shared/components/FloatingActionBar";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { bookCountLabel } from "@/shared/utils/bookCountLabel";

/**
 * The floating bar under the cart: what is due now, and the one next step. While a book cannot be
 * ordered the step is to remove it; while logged out the step is to log in; otherwise the checkout,
 * which for a cart with nothing to pay is simply confirming the order.
 */
export default function CartBar({
  count,
  total,
  payLater,
  conflictCount,
  isLoggedIn,
  onRemoveConflicts,
}: {
  count: number;
  total: number;
  payLater: number;
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
  const books = bookCountLabel(count);
  const free = total === 0 && payLater === 0;
  const summary = free ? books : `Betal nå ${kroner(total)}`;
  if (!isLoggedIn) {
    return (
      <FloatingActionBar visible summary={summary} detail="Logg inn for å fullføre bestillingen.">
        <Button
          renderRoot={(props) => (
            <TanStackAnchor to="/auth/login" search={{ redirect: "handlekurv" }} {...props} />
          )}
          radius="xl"
          leftSection={<IconLogin2 />}
        >
          {free ? "Logg inn og bekreft" : "Logg inn og gå til kassen"}
        </Button>
      </FloatingActionBar>
    );
  }
  if (free) {
    return (
      <FloatingActionBar visible summary={summary}>
        <Button component={TanStackAnchor} to="/kasse" radius="xl" leftSection={<IconCheck />}>
          Bekreft bestillingen
        </Button>
      </FloatingActionBar>
    );
  }
  return (
    <FloatingActionBar
      visible
      summary={summary}
      detail={payLater > 0 ? `${books}, ${kroner(payLater)} betales senere` : books}
    >
      <Button component={TanStackAnchor} to="/kasse" radius="xl" leftSection={<IconBasket />}>
        Gå til kassen
      </Button>
    </FloatingActionBar>
  );
}
