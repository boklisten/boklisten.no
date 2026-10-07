import { lineKey } from "@boklisten/backend/shared/stand_cart";
import type { StandCartSource } from "@boklisten/backend/shared/stand_cart";
import type { User } from "@boklisten/backend/shared/user";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { buildOpenOrderInfo, buildReceiveFromPeers } from "@/features/customer-search/handoutBooks";
import type { HandoutRow } from "@/features/customer-search/HandoutBooksList";
import { api } from "@/shared/utils/apiClient";

const POLL_INTERVAL_MS = 5000;

/**
 * The books the customer has ordered and not got yet, which go into the cart by a click or by a
 * scan. One another student is to bring carries that student's name and sorts last in its group.
 */
export function useHandoutRows(customer: User) {
  const queryClient = useQueryClient();
  const { data: orders } = useQuery(
    api.orders.placedForCustomer.queryOptions(
      { params: { userId: customer.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );
  const { data: matchData } = useQuery(
    api.matches.forCustomer.queryOptions(
      { params: { userId: customer.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );
  const { data: branches } = useQuery(api.branches.index.queryOptions());

  const openOrderInfo = buildOpenOrderInfo(orders ?? []);
  const receiveFrom = buildReceiveFromPeers(
    [...openOrderInfo.keys()],
    matchData ?? [],
    customer.id,
    (itemId) => ({ key: itemId, itemId }),
  );
  const branchName = (branchId: string) =>
    branches?.find((branch) => branch.id === branchId)?.name ?? null;

  const orderedRows: HandoutRow[] = [...openOrderInfo].map(([itemId, info]) => {
    const peer = receiveFrom.get(itemId);
    const cartSource: StandCartSource = { kind: "order", orderId: info.orderId, itemId };
    return {
      key: lineKey(cartSource),
      itemId,
      orderId: info.orderId,
      title: info.title,
      isbn: info.isbn,
      type: info.type,
      branchId: info.branchId,
      branchName: branchName(info.branchId),
      alsoMoving: [...openOrderInfo]
        .filter(([otherItemId, other]) => other.orderId === info.orderId && otherItemId !== itemId)
        .map(([, other]) => other.title),
      deadline: info.deadline,
      receiveFrom: peer,
      cartSource,
    };
  });
  const refreshOrders = () =>
    void queryClient.invalidateQueries({ queryKey: api.orders.placedForCustomer.pathKey() });

  return {
    loaded: orders !== undefined,
    // The stand's own books first in each deadline group; those a student brings follow
    rows: orderedRows.toSorted(
      (a, b) => Number(a.receiveFrom !== undefined) - Number(b.receiveFrom !== undefined),
    ),
    refreshOrders,
  };
}
