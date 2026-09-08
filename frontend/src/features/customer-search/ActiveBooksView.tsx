import type { ActiveCustomerItem } from "@boklisten/backend/shared/customer-item/active-customer-item";
import { itemsAreEquivalent } from "@boklisten/backend/shared/item-equivalence";
import type { MatchDto } from "@boklisten/backend/shared/match/match-dto";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Badge, Box, Group, Skeleton, Stack, Table, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { isOverdue } from "@/features/bulk-collection/deadline";
import {
  ActiveBookBranchChip,
  ActiveBookDeadlineChip,
} from "@/features/customer-search/ActiveBookChips";
import BookRowCard from "@/features/customer-search/BookRowCard";
import { buildPeerBooks } from "@/features/customer-search/handoutBooks";
import { showBookSearch } from "@/features/kasse/kasseParams";
import AddToCartButton from "@/features/stand-cart/AddToCartButton";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { PeerBadge } from "@/shared/components/matches/matches-helper";
import EntityLink from "@/shared/components/EntityLink";
import useApiClient from "@/shared/hooks/useApiClient";

/** The unique ID doubles as the way into the book's own history. */
function BlidLink({ blid }: { blid: string }) {
  return (
    <EntityLink
      to="/admin/kasse"
      search={showBookSearch(blid)}
      size="sm"
      ff="monospace"
      aria-label={`Se historikken til bok ${blid}`}
    >
      {blid}
    </EntityLink>
  );
}

/**
 * The peer each book is due to be given to, keyed by customer-item id. Matching is
 * edition-tolerant, and each pending obligation is consumed by at most one book so two copies of
 * the same title go to their respective students.
 */
function buildDeliverToNames(
  books: ActiveCustomerItem[],
  matches: MatchDto[],
  customerId: string,
): Map<string, string> {
  const pending = buildPeerBooks(matches, customerId).giveBooks.filter((book) => !book.fulfilled);
  const names = new Map<string, string>();
  for (const book of books) {
    const index = pending.findIndex((peerBook) => itemsAreEquivalent(peerBook.id, book.item));
    if (index === -1) {
      continue;
    }
    const [peerBook] = pending.splice(index, 1);
    if (peerBook) {
      names.set(book.id, peerBook.personName);
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
  deliverToNames,
}: {
  customerId: string;
  books: ActiveCustomerItem[];
  deliverToNames: Map<string, string>;
}) {
  return (
    <Stack gap="xs" hiddenFrom="md">
      {books.map((book) => {
        const deliverToName = deliverToNames.get(book.id);
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
                {deliverToName && (
                  <Group>
                    <PeerBadge>Leveres til {deliverToName}</PeerBadge>
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
  deliverToNames,
}: {
  customerId: string;
  books: ActiveCustomerItem[];
  deliverToNames: Map<string, string>;
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
            const deliverToName = deliverToNames.get(book.id);
            return (
              <Table.Tr key={book.id}>
                <Table.Td>
                  <Stack gap={2} align="flex-start">
                    <Text fw={500}>{book.title}</Text>
                    {deliverToName && <PeerBadge>Leveres til {deliverToName}</PeerBadge>}
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

export default function ActiveBooksView({ customer }: { customer: UserDetail }) {
  const customerId = customer.id;
  const { api } = useApiClient();
  const {
    data: books,
    isPending,
    isError,
  } = useQuery(
    api.customerItems.getActiveCustomerItemsForCustomer.queryOptions({
      params: { detailsId: customerId },
    }),
  );
  const { data: matches } = useQuery(
    api.matches.getMatchesForCustomer.queryOptions({ params: { customerId } }),
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
  const deliverToNames = buildDeliverToNames(books, matches ?? [], customerId);

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
      <BookCards customerId={customerId} books={books} deliverToNames={deliverToNames} />
      <BookTable customerId={customerId} books={books} deliverToNames={deliverToNames} />
    </Stack>
  );
}
