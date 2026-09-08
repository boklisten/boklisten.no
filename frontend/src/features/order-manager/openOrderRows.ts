import { isOpenOrderHistoryItem } from "@boklisten/backend/shared/order/open-order-item";
import type { OrderHistoryEntry } from "@boklisten/backend/shared/order/order-history";
import { lineKey } from "@boklisten/backend/shared/stand_cart";
import type { StandCartSource } from "@boklisten/backend/shared/stand_cart";

import type { HandoutRow } from "@/features/customer-search/HandoutBooksTable";

/** The books on this order the stand still owes, as rows of the same table the Bestillinger tab uses. */
export function openOrderRows(order: OrderHistoryEntry): HandoutRow[] {
  const open = order.items.filter((item) => isOpenOrderHistoryItem(item));
  return open.map((item) => {
    const cartSource: StandCartSource = { kind: "order", orderId: order.id, itemId: item.itemId };
    return {
      key: lineKey(cartSource),
      itemId: item.itemId,
      orderId: order.id,
      title: item.title,
      type: item.type,
      branchId: order.branch.id,
      branchName: order.branch.name,
      alsoMoving: open.filter((other) => other !== item).map((other) => other.title),
      deadline: item.period?.to,
      receiveFromName: undefined,
      cartSource,
    };
  });
}
