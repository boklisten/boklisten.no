import { ACQUISITION_CART_ITEM_TYPES } from "@boklisten/backend/shared/cart_item";
import type { OrderHistoryEntry } from "@boklisten/backend/shared/order/order-history";
import { Skeleton, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import { api } from "@/shared/utils/apiClient";

/** The order item types that hand the customer a new book, which then has to reach them. */
const HANDOUT_TYPES = new Set<string>(ACQUISITION_CART_ITEM_TYPES);

/**
 * The order is placed: say so, and say how the books reach the customer when the order hands any
 * out. Books ordered by post are sent; the rest are collected at the stand. An order that only
 * extends or buys out books the customer already has needs no such instruction.
 */
export default function OrderPlacedAlert({ order }: { order: OrderHistoryEntry }) {
  const handsOut = order.items.some((item) => HANDOUT_TYPES.has(item.type));
  const byMail = order.delivery?.method === "bring";
  return (
    <SuccessAlert title="Bestillingen er bekreftet">
      <Stack gap="xs">
        {handsOut && byMail && <Text size="sm">Bøkene blir sendt i posten om kort tid.</Text>}
        {handsOut && !byMail && (
          <Text size="sm">
            Du kan hente bøkene på stand i våre åpningstider. Dersom du går på VGS kan du kontakte
            en av våre kontakt-elever.
          </Text>
        )}
        <Text size="sm">Vi har også sendt en bekreftelse på e-post.</Text>
      </Stack>
    </SuccessAlert>
  );
}

/** The alert for an order the customer just placed, once the order has been fetched. */
export function PlacedOrderNotice({ orderId }: { orderId: string }) {
  const { data: order, isPending } = useQuery(
    api.orders.showMe.queryOptions({ params: { orderId } }),
  );
  if (isPending) {
    return <Skeleton h={90} radius="md" />;
  }
  // A failed lookup is reported where the order itself is shown; the notice just stays away
  if (!order) {
    return null;
  }
  return <OrderPlacedAlert order={order} />;
}
