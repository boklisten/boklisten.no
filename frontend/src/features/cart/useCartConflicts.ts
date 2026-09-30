import { ACQUISITION_CART_ITEM_TYPES } from "@boklisten/backend/shared/cart_item";
import type { CartItem, CartItemOption } from "@boklisten/backend/shared/cart_item";
import { useQuery } from "@tanstack/react-query";

import useAuth from "@/shared/hooks/useAuth";
import { api } from "@/shared/utils/apiClient";

/** Why a line cannot be ordered: the pupil already has the book, or has already ordered it. */
export type CartConflict = "owned" | "ordered";

/**
 * Looks up the books the customer already has or has ordered, so a line that would hand out a
 * second copy can be marked. Only acquisitions conflict; extending or buying out a book the pupil
 * has is the point. Nothing is known while logged out, so nothing conflicts.
 */
export default function useCartConflicts() {
  const { isLoggedIn } = useAuth();
  // The flags must reflect orders placed seconds ago, so bypass the global staleTime
  const { data: openOrderItems } = useQuery({
    ...api.orders.openItemsMe.queryOptions(),
    enabled: isLoggedIn,
    staleTime: 0,
  });
  const { data: customerItems } = useQuery({
    ...api.customerItems.me.queryOptions(),
    enabled: isLoggedIn,
    staleTime: 0,
  });

  const ownedItemIds = new Set(
    customerItems
      ?.filter((customerItem) => ["active", "overdue"].includes(customerItem.status.type))
      .map((customerItem) => customerItem.item.id),
  );
  const orderedItemIds = new Set(openOrderItems?.map((orderItem) => orderItem.itemId));

  return function conflictOf(cartItem: CartItem, option: CartItemOption): CartConflict | null {
    if (!ACQUISITION_CART_ITEM_TYPES.includes(option.type)) {
      return null;
    }
    if (ownedItemIds.has(cartItem.id)) {
      return "owned";
    }
    if (orderedItemIds.has(cartItem.id)) {
      return "ordered";
    }
    return null;
  };
}
