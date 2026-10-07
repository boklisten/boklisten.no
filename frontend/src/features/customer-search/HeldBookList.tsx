import type { ActiveCustomerItem } from "@boklisten/backend/shared/customer-item/active-customer-item";
import { Group } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import BookDetailsModal from "@/features/book-list/BookDetailsModal";
import BookGroup from "@/features/book-list/BookGroup";
import BookRow from "@/features/book-list/BookRow";
import { groupBooks } from "@/features/book-list/bookGroups";
import InvoiceBadge from "@/features/book-list/InvoiceBadge";
import PeerNameBadge from "@/features/book-list/PeerNameBadge";
import {
  ActiveBookBranchChip,
  ActiveBookDeadlineChip,
} from "@/features/customer-search/ActiveBookChips";
import { buildDeliverToPeers } from "@/features/customer-search/handoutBooks";
import type { PeerBook } from "@/features/customer-search/handoutBooks";
import BlidLink from "@/features/kasse/BlidLink";
import AddToCartButton from "@/features/stand-cart/AddToCartButton";
import { api } from "@/shared/utils/apiClient";

/** The fixes an employee can make to a handed-out book, shown in its details. */
function Corrections({ book }: { book: ActiveCustomerItem }) {
  return (
    <Group gap={6}>
      <ActiveBookBranchChip book={book} />
      <ActiveBookDeadlineChip book={book} />
    </Group>
  );
}

/**
 * The books a customer holds, and the student each is to be handed to when it goes on through an
 * overlevering. `books` is undefined while loading.
 */
export function useHeldBooks(customerId: string) {
  const { data: books, isError } = useQuery(
    api.customerItems.forCustomer.queryOptions({ params: { userId: customerId } }),
  );
  const { data: matches } = useQuery(
    api.matches.forCustomer.queryOptions({ params: { userId: customerId } }),
  );
  const deliverTo = buildDeliverToPeers(
    (books ?? []).map((book) => ({ id: book.id, itemId: book.item })),
    matches ?? [],
    customerId,
  );
  return {
    isError,
    books,
    deliverTo,
  };
}

/**
 * Held books grouped by deadline, each going into the cart from its row (to return, extend or buy
 * out) and opening its details, with the corrections, from its title.
 */
export default function HeldBookList({
  customerId,
  books,
  deliverTo,
}: {
  customerId: string;
  books: ActiveCustomerItem[];
  deliverTo: Map<string, PeerBook>;
}) {
  const [openedId, setOpenedId] = useState<string | null>(null);
  // Looked up on every render so the corrections follow the list after an edit.
  const opened = books.find((book) => book.id === openedId);
  const openedPeer = opened && deliverTo.get(opened.id);
  return (
    <>
      {groupBooks(books, (book) => ({
        type: book.type,
        branchName: book.handoutBranch.name,
        deadline: book.deadline,
      })).map((group) => (
        <BookGroup key={group.key} group={group}>
          {group.books.map((book) => {
            const peer = deliverTo.get(book.id);
            return (
              <BookRow
                key={book.id}
                title={book.title}
                isbn={book.isbn}
                meta={
                  <>
                    {book.blid && <BlidLink blid={book.blid} />}
                    <InvoiceBadge invoice={book.invoice} />
                    {peer && <PeerNameBadge label="Leveres til" peer={peer} linked />}
                  </>
                }
                action={
                  <AddToCartButton
                    customerId={customerId}
                    source={{ kind: "customerItem", customerItemId: book.id }}
                  />
                }
                onOpen={() => setOpenedId(book.id)}
                tone={peer ? "peer" : undefined}
              />
            );
          })}
        </BookGroup>
      ))}
      <BookDetailsModal
        target={opened ? { kind: "customer-item", id: opened.id } : null}
        audience="employee"
        corrections={opened && <Corrections book={opened} />}
        note={openedPeer && <PeerNameBadge label="Leveres til" peer={openedPeer} linked />}
        onClose={() => setOpenedId(null)}
      />
    </>
  );
}
