import { IconBasket } from "@tabler/icons-react";
import { useLocation } from "@tanstack/react-router";

import { kroner } from "@/features/cart/cartLabels";
import FloatingActionBar from "@/shared/components/FloatingActionBar";
import TanStackButton from "@/shared/components/TanStackButton";
import useCart from "@/shared/hooks/useCart";
import { bookCountLabel } from "@/shared/utils/bookCountLabel";

export default function AffixCartIndicator() {
  const cart = useCart();
  const pathname = useLocation({ select: (location) => location.pathname });
  const total = cart.calculateTotal();
  return (
    <FloatingActionBar
      visible={!cart.isEmpty() && pathname.includes("items")}
      summary={`${bookCountLabel(cart.size())} valgt`}
      detail={total > 0 ? `Totalt ${kroner(total)}` : undefined}
    >
      <TanStackButton to="/handlekurv" radius="xl" leftSection={<IconBasket />}>
        Gå til handlekurv
      </TanStackButton>
    </FloatingActionBar>
  );
}
