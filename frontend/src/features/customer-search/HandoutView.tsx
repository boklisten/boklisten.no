import { itemsAreEquivalent } from "@boklisten/backend/shared/item-equivalence";
import { lineKey } from "@boklisten/backend/shared/stand_cart";
import type { StandCartSource } from "@boklisten/backend/shared/stand_cart";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Stack } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { buildOpenOrderInfo, buildPeerBooks } from "@/features/customer-search/handoutBooks";
import HandoutBooksTable from "@/features/customer-search/HandoutBooksTable";
import type { HandoutRow } from "@/features/customer-search/HandoutBooksTable";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { publicApi } from "@/shared/utils/publicApiClient";

const POLL_INTERVAL_MS = 5000;

/**
 * Everything the customer is due to get: ordered books, which go into the cart by a click here
 * or by a scan from the page, and books due from another student, which never pass the stand.
 */
export default function HandoutView({ customer }: { customer: UserDetail }) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const { data: orders } = useQuery(
    api.orders.getPlacedOrders.queryOptions(
      { params: { detailsId: customer.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );
  const { data: matchData } = useQuery(
    api.matches.getMatchesForCustomer.queryOptions(
      { params: { customerId: customer.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );
  const { data: branches } = useQuery(publicApi.branches.getAll.queryOptions());

  const openOrderInfo = buildOpenOrderInfo(orders ?? []);
  const { receiveBooks } = buildPeerBooks(matchData ?? [], customer.id);
  const branchName = (branchId: string) =>
    branches?.find((branch) => branch.id === branchId)?.name ?? null;

  // Ordered books first: they are the ones the stand hands out. A book both ordered and due from
  // a peer carries that student's name; a peer book nobody ordered is listed after, until the
  // transfer has happened.
  const orderedRows: HandoutRow[] = [...openOrderInfo].map(([itemId, info]) => {
    const peer = receiveBooks.find((book) => itemsAreEquivalent(book.id, itemId));
    const cartSource: StandCartSource = { kind: "order", orderId: info.orderId, itemId };
    return {
      key: lineKey(cartSource),
      itemId,
      orderId: info.orderId,
      title: info.title,
      type: info.type,
      branchId: info.branchId,
      branchName: branchName(info.branchId),
      alsoMoving: [...openOrderInfo]
        .filter(([otherItemId, other]) => other.orderId === info.orderId && otherItemId !== itemId)
        .map(([, other]) => other.title),
      deadline: info.deadline,
      receiveFromName: peer?.personName,
      cartSource,
    };
  });
  const peerRows: HandoutRow[] = receiveBooks
    .filter((book) => !book.fulfilled && !openOrderInfo.has(book.id))
    .map((book) => ({
      key: `peer:${book.id}`,
      itemId: book.id,
      orderId: null,
      title: book.title,
      type: null,
      branchId: null,
      branchName: null,
      alsoMoving: [],
      deadline: undefined,
      receiveFromName: book.personName,
      cartSource: null,
    }));
  const rows = [...orderedRows, ...peerRows];

  if (orders !== undefined && rows.length === 0) {
    return (
      <InfoAlert>
        Denne kunden har ingen bestilte bøker. Bøker du skanner legges i handlekurven uten
        bestilling.
      </InfoAlert>
    );
  }

  const refreshOrders = () =>
    void queryClient.invalidateQueries({ queryKey: api.orders.getPlacedOrders.pathKey() });

  return (
    <Stack gap="lg">
      {rows.length > 0 && (
        <HandoutBooksTable customerId={customer.id} rows={rows} onChanged={refreshOrders} />
      )}
    </Stack>
  );
}
