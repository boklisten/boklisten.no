import type { ActiveCustomerItem } from "@boklisten/backend/shared/customer-item/active-customer-item";
import { itemsAreEquivalent } from "@boklisten/backend/shared/item-equivalence";
import type { MatchDto } from "@boklisten/backend/shared/match/match-dto";
import type { User } from "@boklisten/backend/shared/user";
import { Badge, Box, Group, Skeleton, Stack, Table, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { isOverdue } from "@/features/bulk-collection/deadline";
import {
  ActiveBookBranchChip,
  ActiveBookDeadlineChip,
} from "@/features/customer-search/ActiveBookChips";
import BookRowCard from "@/features/customer-search/BookRowCard";
import { buildPeerBooks } from "@/features/customer-search/handoutBooks";
import type { PeerBook } from "@/features/customer-search/handoutBooks";
import BlidLink from "@/features/kasse/BlidLink";
import CustomerLink from "@/features/kasse/CustomerLink";
import AddToCartButton from "@/features/stand-cart/AddToCartButton";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { PeerBadge } from "@/shared/components/matches/matches-helper";
import { api } from "@/shared/utils/apiClient";

/** "Leveres til Ola": the student the book is due to go to, as a way into their Kasse view. */
function DeliverToBadge({ peer }: { peer: PeerBook }) {
  return (
    <PeerBadge>
      Leveres til{" "}
      {peer.personId === null ? (
        peer.personName
      ) : (
        <CustomerLink detailsId={peer.personId} inherit>
          {peer.personName}
        </CustomerLink>
      )}
    </PeerBadge>
  );
}

/**
 * The peer each book is due to be given to, keyed by customer-item id. Matching is
 * edition-tolerant, and each pending obligation is consumed by at most one book so two copies of
 * the same title go to their respective students.
 */
function buildDeliverToPeers(
  books: ActiveCustomerItem[],
  matches: MatchDto[],
  customerId: string,
): Map<string, PeerBook> {
  const pending = buildPeerBooks(matches, customerId).giveBooks.filter((book) => !book.fulfilled);
  const names = new Map<string, PeerBook>();
  for (const book of books) {
    const index = pending.findIndex((peerBook) => itemsAreEquivalent(peerBook.id, book.item));
    if (index === -1) {
      continue;
    }
    const [peerBook] = pending.splice(index, 1);
    if (peerBook) {
      names.set(book.id, peerBook);
    }
  }
  return names;
}

function cartButton(customerId: string, book: ActiveCustomerItem, compact = false) {
  return (
    <AddToCartButton
      customerId={customerId}
      source={{ kind: "customerItem", customerItemId: book.id }}
      compact={compact}
    />
  );
}

function BookCards({
  customerId,
  books,
  deliverToPeers,
}: {
  customerId: string;
  books: ActiveCustomerItem[];
  deliverToPeers: Map<string, PeerBook>;
}) {
  return (
    <Stack gap="xs" hiddenFrom="md">
      {books.map((book) => {
        const deliverTo = deliverToPeers.get(book.id);
        return (
          <BookRowCard
            key={book.id}
            title={book.title}
            action={cartButton(customerId, book, true)}
            notes={
              <>
                {book.blid && (
                  <Group>
                    <BlidLink blid={book.blid} />
                  </Group>
                )}
                {deliverTo && (
                  <Group>
                    <DeliverToBadge peer={deliverTo} />
                  </Group>
                )}
              </>
            }
            chips={
              <>
                <ActiveBookBranchChip book={book} />
                <ActiveBookDeadlineChip book={book} />
              </>
            }
          />
        );
      })}
    </Stack>
  );
}

function BookTable({
  customerId,
  books,
  deliverToPeers,
}: {
  customerId: string;
  books: ActiveCustomerItem[];
  deliverToPeers: Map<string, PeerBook>;
}) {
  return (
    <Box visibleFrom="md">
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tittel</Table.Th>
            <Table.Th>Unik ID</Table.Th>
            <Table.Th>Filial</Table.Th>
            <Table.Th>Frist</Table.Th>
            <Table.Th>Handling</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {books.map((book) => {
            const deliverTo = deliverToPeers.get(book.id);
            return (
              <Table.Tr key={book.id}>
                <Table.Td>
                  <Stack gap={2} align="flex-start">
                    <Text fw={500}>{book.title}</Text>
                    {deliverTo && <DeliverToBadge peer={deliverTo} />}
                  </Stack>
                </Table.Td>
                <Table.Td>{book.blid ? <BlidLink blid={book.blid} /> : "–"}</Table.Td>
                <Table.Td>
                  <ActiveBookBranchChip book={book} />
                </Table.Td>
                <Table.Td>
                  <ActiveBookDeadlineChip book={book} />
                </Table.Td>
                <Table.Td>{cartButton(customerId, book)}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

export default function ActiveBooksView({ customer }: { customer: User }) {
  const customerId = customer.id;
  const {
    data: books,
    isPending,
    isError,
  } = useQuery(
    api.customerItems.forCustomer.queryOptions({
      params: { detailsId: customerId },
    }),
  );
  const { data: matches } = useQuery(
    api.matches.forCustomer.queryOptions({ params: { detailsId: customerId } }),
  );

  if (isPending) {
    return (
      <Stack gap="xs">
        <Skeleton height={20} width="40%" radius="sm" />
        <Skeleton height={44} radius="sm" />
        <Skeleton height={44} radius="sm" />
      </Stack>
    );
  }

  if (isError) {
    return <ErrorAlert>Klarte ikke laste inn kundens bøker.</ErrorAlert>;
  }

  if (books.length === 0) {
    return <InfoAlert>Kunden har ingen aktive bøker.</InfoAlert>;
  }

  const overdueCount = books.filter((book) => isOverdue(String(book.deadline))).length;
  const deliverToPeers = buildDeliverToPeers(books, matches ?? [], customerId);

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Text size="sm" c="dimmed">
          {books.length} {books.length === 1 ? "aktiv bok" : "aktive bøker"}
        </Text>
        {overdueCount > 0 && (
          <Badge color="red" variant="light">
            {overdueCount} over frist
          </Badge>
        )}
      </Group>
      <BookCards customerId={customerId} books={books} deliverToPeers={deliverToPeers} />
      <BookTable customerId={customerId} books={books} deliverToPeers={deliverToPeers} />
    </Stack>
  );
}
