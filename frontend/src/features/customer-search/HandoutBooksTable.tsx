import type { OrderItemType } from "@boklisten/backend/shared/order/order-item/order-item-type";
import type { StandCartSource } from "@boklisten/backend/shared/stand_cart";
import { Badge, Box, Stack, Table, Text } from "@mantine/core";

import BookRowCard from "@/features/customer-search/BookRowCard";
import OrderItemDeadlineChip from "@/features/customer-search/OrderItemDeadlineChip";
import OrderBranchChip from "@/features/order-history/OrderBranchChip";
import AddToCartButton from "@/features/stand-cart/AddToCartButton";
import { PeerBadge } from "@/shared/components/matches/matches-helper";
import { norwegianTime } from "@/shared/utils/dayjs";

const TYPE_LABELS: Partial<Record<OrderItemType, string>> = {
  rent: "Lån",
  "partly-payment": "Delbetaling",
  buy: "Kjøp",
};

export interface HandoutRow {
  key: string;
  itemId: string;
  /** The open order the book sits on; null for a book that is only due from a peer. */
  orderId: string | null;
  title: string;
  /** The ordered type; null for a book that is only due from a peer. */
  type: OrderItemType | null;
  branchId: string | null;
  branchName: string | null;
  /** Titles of the other ordered books on the same order, which move with it when its branch changes. */
  alsoMoving: string[];
  deadline: Date | string | undefined;
  /** The student the book is due from, when it comes from a peer rather than the stand. */
  receiveFromName: string | undefined;
  /** How the book goes into the cart; null for a peer book, which never passes the stand. */
  cartSource: StandCartSource | null;
}

/** "Lån til 20.12.2026" or just the type when the order carries no period. */
function periodLabel(row: HandoutRow): string | null {
  if (row.type === null) {
    return null;
  }
  const label = TYPE_LABELS[row.type] ?? row.type;
  return row.deadline === undefined
    ? label
    : `${label} til ${norwegianTime(row.deadline).format("DD.MM.YYYY")}`;
}

/**
 * The ordered period: an editable chip while the book sits on an open order, since an employee
 * may move the deadline before the handout; a plain badge otherwise.
 */
function Period({ row, onChanged }: { row: HandoutRow; onChanged: () => void }) {
  if (
    row.orderId !== null &&
    row.type !== null &&
    row.type !== "buy" &&
    row.deadline !== undefined
  ) {
    return (
      <OrderItemDeadlineChip
        orderId={row.orderId}
        itemId={row.itemId}
        type={row.type}
        deadline={row.deadline}
        onChanged={onChanged}
      />
    );
  }
  const period = periodLabel(row);
  return period === null ? null : (
    <Badge variant="light" color="gray" tt="none">
      {period}
    </Badge>
  );
}

/** Whom the book comes from, under its title, when it is due from a peer rather than the stand. */
function TitleNotes({ row }: { row: HandoutRow }) {
  return row.receiveFromName === undefined ? null : (
    <PeerBadge>Mottas fra {row.receiveFromName}</PeerBadge>
  );
}

/**
 * The branch the book is ordered on: an editable chip while it sits on an open order, the same
 * way a handed-out book's branch is edited on the other tab. The order moves as a whole, so the
 * chip names the other books that go with it.
 */
function Branch({ row, onChanged }: { row: HandoutRow; onChanged: () => void }) {
  if (row.branchName === null) {
    return null;
  }
  if (row.orderId !== null && row.branchId !== null) {
    return (
      <OrderBranchChip
        orderId={row.orderId}
        branchId={row.branchId}
        branchName={row.branchName}
        alsoMoving={row.alsoMoving}
        onChanged={onChanged}
      />
    );
  }
  return (
    <Badge variant="light" color="gray" tt="none">
      {row.branchName}
    </Badge>
  );
}

/**
 * Every book the customer is still due to get, as a table on wide screens and cards on narrow
 * ones, with the same columns as the customer's active books so the two tabs line up. Both the
 * branch and the deadline can be corrected in place.
 */
export default function HandoutBooksTable({
  customerId,
  rows,
  onChanged,
}: {
  customerId: string;
  rows: HandoutRow[];
  /** Called after a branch or deadline was changed, so the lists behind the rows refresh. */
  onChanged: () => void;
}) {
  const cartButton = (row: HandoutRow, compact: boolean) =>
    row.cartSource === null ? null : (
      <AddToCartButton customerId={customerId} source={row.cartSource} compact={compact} />
    );
  return (
    <>
      <Stack gap="xs" hiddenFrom="md">
        {rows.map((row) => (
          <BookRowCard
            key={row.key}
            title={row.title}
            action={cartButton(row, true)}
            notes={<TitleNotes row={row} />}
            chips={
              row.branchName === null ? undefined : (
                <>
                  <Branch row={row} onChanged={onChanged} />
                  <Period row={row} onChanged={onChanged} />
                </>
              )
            }
          />
        ))}
      </Stack>
      <Box visibleFrom="md">
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tittel</Table.Th>
              <Table.Th>Filial</Table.Th>
              <Table.Th>Frist</Table.Th>
              <Table.Th>Handling</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.key}>
                <Table.Td>
                  <Stack gap={2} align="flex-start">
                    <Text fw={500}>{row.title}</Text>
                    <TitleNotes row={row} />
                  </Stack>
                </Table.Td>
                <Table.Td>
                  {row.branchName === null ? "–" : <Branch row={row} onChanged={onChanged} />}
                </Table.Td>
                <Table.Td>
                  {row.type === null ? "–" : <Period row={row} onChanged={onChanged} />}
                </Table.Td>
                <Table.Td>{cartButton(row, false)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    </>
  );
}
