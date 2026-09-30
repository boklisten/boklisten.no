import { Button } from "@mantine/core";
import { IconBasket } from "@tabler/icons-react";
import { useLocation } from "@tanstack/react-router";

import FloatingActionBar from "@/shared/components/FloatingActionBar";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useCart from "@/shared/hooks/useCart";

export default function AffixCartIndicator() {
  const cart = useCart();
  const pathname = useLocation({ select: (location) => location.pathname });
  const size = cart.size();
  return (
    <FloatingActionBar
      visible={!cart.isEmpty() && pathname.includes("items")}
      summary={`${size} ${size === 1 ? "bok" : "bøker"} valgt`}
      detail={`Totalt ${cart.calculateTotal()} kr`}
    >
      <Button component={TanStackAnchor} to="/handlekurv" radius="xl" leftSection={<IconBasket />}>
        Gå til handlekurv
      </Button>
    </FloatingActionBar>
  );
}
