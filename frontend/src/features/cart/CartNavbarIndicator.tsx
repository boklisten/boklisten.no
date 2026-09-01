import { Badge, Indicator, Tooltip } from "@mantine/core";
import { IconBasket } from "@tabler/icons-react";

import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useCart from "@/shared/hooks/useCart";

export default function CartNavbarIndicator() {
  const cart = useCart();

  if (cart.isEmpty()) {
    return null;
  }
  return (
    <Tooltip label="Gå til handlekurv">
      <TanStackAnchor to="/handlekurv">
        <Indicator
          inline
          label={
            <Badge style={{ cursor: "pointer" }} circle color="red" size="sm">
              {cart.size()}
            </Badge>
          }
        >
          <IconBasket color="white" />
        </Indicator>
      </TanStackAnchor>
    </Tooltip>
  );
}
