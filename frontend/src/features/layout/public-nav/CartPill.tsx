import { IconBasket } from "@tabler/icons-react";

import NavAnchor from "@/features/layout/nav/NavAnchor";
import classes from "@/features/layout/nav/Nav.module.css";
import { isNavLinkActive, usePathname } from "@/features/layout/nav/navigation";
import { CART_PATH } from "@/features/layout/public-nav/publicNavigation";
import useCart from "@/shared/hooks/useCart";
import { bookCountLabel } from "@/shared/utils/bookCountLabel";

/** The way to the cart, shown only while there is something in it. */
export default function CartPill() {
  const cart = useCart();
  const active = isNavLinkActive({ to: CART_PATH }, usePathname());
  if (cart.isEmpty()) {
    return null;
  }
  const size = cart.size();
  return (
    <NavAnchor
      to={CART_PATH}
      active={active}
      className={classes.cart}
      data-key={CART_PATH}
      aria-label={`Handlekurv, ${bookCountLabel(size)}`}
    >
      <IconBasket size={18} aria-hidden />
      {size}
    </NavAnchor>
  );
}
