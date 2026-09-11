import { Text } from "@mantine/core";
import { IconBasket } from "@tabler/icons-react";

import useDisplayName from "@/features/customer-search/useDisplayName";
import { showCustomer } from "@/features/kasse/kasseParams";
import { formatAmount } from "@/features/stand-cart/standCartLabels";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import EntityLink from "@/shared/components/EntityLink";
import ListBar from "@/shared/components/ListBar";

function countLabel(count: number): string {
  return count === 1 ? "1 bok i handlekurven" : `${count} bøker i handlekurven`;
}

function problemsLabel(count: number): string {
  return count === 1 ? "1 bok trenger et valg" : `${count} bøker trenger et valg`;
}

/**
 * What still needs a choice, else the sum the same way the cart's Totalt row writes it (signed,
 * red when negative), else nothing — a free handout has no price.
 */
function summaryLine(cart: StandCart): { text: string; color: string } | null {
  const problems = cart.problems.length;
  if (problems > 0) {
    return { text: problemsLabel(problems), color: "orange" };
  }
  if (!cart.hasPrice) {
    return null;
  }
  return { text: `Totalt: ${formatAmount(cart.total)}`, color: cart.total < 0 ? "red" : "dimmed" };
}

/**
 * The cart while it has lines: whose it is, what is in it, what it costs, and the one way in. The
 * customer's name is a link to them, since the cart follows the employee to other customers and
 * books; "Åpne" brings the customer back on screen with the cart open on top.
 */
export default function StandCartBar({
  cart,
  customer,
  onOpen,
}: {
  cart: StandCart;
  /**
   * Whose cart it is; shown when the cart may be on screen without its customer. `onFollow` runs
   * when the name is followed, for a host that must get out of the way (the camera modal).
   */
  customer?: { detailsId: string; name: string | null; onFollow?: () => void } | undefined;
  onOpen: () => void;
}) {
  const displayName = useDisplayName();
  if (cart.isEmpty) {
    return null;
  }
  const summary = summaryLine(cart);
  return (
    <ListBar
      icon={<IconBasket size={20} aria-hidden />}
      label="Handlekurv"
      heading={countLabel(cart.cart.lines.length)}
      detail={
        <>
          {customer !== undefined &&
            customer.name !== null && (
              // Reads like the detail line it is, and only shows as a link on hover
              <EntityLink
                to="/admin/kasse"
                search={showCustomer(customer.detailsId)}
                onClick={customer.onFollow}
                size="sm"
                fw={400}
                c="dimmed"
                lh={1.3}
              >
                {displayName(customer.name)}
              </EntityLink>
            )}
          {summary && (
            <Text size="sm" c={summary.color} lh={1.3}>
              {summary.text}
            </Text>
          )}
        </>
      }
      action={{ full: "Åpne handlekurven", short: "Åpne", onPress: onOpen }}
    />
  );
}
