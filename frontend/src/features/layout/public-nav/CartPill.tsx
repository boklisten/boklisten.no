import { IconBasket } from "@tabler/icons-react";

import { CART_PATH } from "@/features/layout/public-nav/publicNavigation";
import classes from "@/features/layout/nav/Nav.module.css";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useCart from "@/shared/hooks/useCart";
import { bookCountLabel } from "@/shared/utils/bookCountLabel";

/** The way to the cart, shown only while there is something in it. */
export default function CartPill() {
  const cart = useCart();
  if (cart.isEmpty()) {
    return null;
  }
  const size = cart.size();
  return (
    <TanStackAnchor
      to={CART_PATH}
      className={classes.cart}
      underline="never"
      data-key={CART_PATH}
      aria-label={`Handlekurv, ${bookCountLabel(size)}`}
    >
      <IconBasket size={18} aria-hidden />
      {size}
    </TanStackAnchor>
  );
}
