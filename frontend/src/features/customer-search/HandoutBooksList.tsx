import type { OrderItemType } from "@boklisten/backend/shared/order/order-item/order-item-type";
import type { StandCartSource } from "@boklisten/backend/shared/stand_cart";
import { Group } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import BookDetailsModal from "@/features/book-list/BookDetailsModal";
import BookGroup from "@/features/book-list/BookGroup";
import BookRow from "@/features/book-list/BookRow";
import { groupBooks } from "@/features/book-list/bookGroups";
import PeerNameBadge from "@/features/book-list/PeerNameBadge";
import type { PeerBook } from "@/features/customer-search/handoutBooks";
import OrderItemDeadlineChip from "@/features/customer-search/OrderItemDeadlineChip";
import OrderBranchChip from "@/features/order-history/OrderBranchChip";
import AddToCartButton from "@/features/stand-cart/AddToCartButton";
import { api } from "@/shared/utils/apiClient";

export interface HandoutRow {
  key: string;
  itemId: string;
  /** The open order the book sits on. */
  orderId: string;
  title: string;
  isbn: string | null;
  type: OrderItemType;
  branchId: string;
  branchName: string | null;
  /** Titles of the other ordered books on the same order, which move with it when its branch changes. */
  alsoMoving: string[];
  /** `YYYY-MM-DD`. */
  deadline: string | undefined;
  /** The student the book is due from, when it comes through an overlevering rather than the stand. */
  receiveFrom: PeerBook | undefined;
  /** How the book goes into the cart. */
  cartSource: StandCartSource;
}

/**
 * The fixes an employee can make to an ordered book before the handout, shown in its details:
 * the order's branch (the whole order moves, so the chip names the other books that go with it)
 * and the period the book is ordered for.
 */
function Corrections({ row, onChanged }: { row: HandoutRow; onChanged: () => void }) {
  if (row.branchName === null) {
    return null;
  }
  return (
    <Group gap={6}>
      <OrderBranchChip
        orderId={row.orderId}
        branchId={row.branchId}
        branchName={row.branchName}
        alsoMoving={row.alsoMoving}
        onChanged={onChanged}
      />
      {row.type !== "buy" && row.deadline !== undefined && (
        <OrderItemDeadlineChip
          orderId={row.orderId}
          itemId={row.itemId}
          type={row.type}
          deadline={row.deadline}
          onChanged={onChanged}
        />
      )}
    </Group>
  );
}

/**
 * Books the customer has ordered and not got yet, grouped by deadline like the books they already
 * hold. Each goes into the cart from its row; one another student is to bring says so on its row,
 * and its button asks before handing it out from the stand.
 */
export default function HandoutBooksList({
  customerId,
  rows,
  onChanged,
}: {
  customerId: string;
  rows: HandoutRow[];
  /** Called after a branch or deadline was changed, so the lists behind the rows refresh. */
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  const opened = rows.find((row) => row.key === openedKey);
  const groups = groupBooks(rows, (row) => ({
    type: row.type,
    branchName: row.branchName,
    deadline: row.type === "buy" ? null : (row.deadline ?? null),
  }));
  return (
    <>
      {groups.map((group) => (
        <BookGroup key={group.key} group={group} held={false}>
          {group.books.map((row) => (
            <BookRow
              key={row.key}
              title={row.title}
              isbn={row.isbn}
              meta={
                row.receiveFrom && (
                  <PeerNameBadge label="Mottas fra" peer={row.receiveFrom} linked />
                )
              }
              tone={row.receiveFrom ? "peer" : undefined}
              action={
                <AddToCartButton
                  customerId={customerId}
                  source={row.cartSource}
                  exceptionLabel={row.receiveFrom && "Del ut likevel"}
                />
              }
              onOpen={() => setOpenedKey(row.key)}
            />
          ))}
        </BookGroup>
      ))}
      <BookDetailsModal
        target={opened ? { kind: "ordered", orderId: opened.orderId, itemId: opened.itemId } : null}
        audience="employee"
        corrections={
          opened && (
            <Corrections
              row={opened}
              onChanged={() => {
                onChanged();
                void queryClient.invalidateQueries({ queryKey: api.orders.itemDetails.pathKey() });
              }}
            />
          )
        }
        note={
          opened?.receiveFrom && (
            <PeerNameBadge label="Mottas fra" peer={opened.receiveFrom} linked />
          )
        }
        onClose={() => setOpenedKey(null)}
      />
    </>
  );
}
