import type { ActiveCustomerItem } from "@boklisten/backend/shared/customer-item/active-customer-item";
import type { CustomerItemType } from "@boklisten/backend/shared/customer-item/customer-item-type";
import { itemsAreEquivalent } from "@boklisten/backend/shared/item-equivalence";
import type { MatchDto } from "@boklisten/backend/shared/match/match-dto";
import { Badge, Box, Card, Code, Group, Skeleton, Stack, Table, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { buildPeerBooks } from "@/features/rapid-handout/handoutBooks";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { PeerBadge } from "@/shared/components/matches/matches-helper";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";

const TYPE_LABELS: Record<CustomerItemType, string> = {
  rent: "Lån",
  "partly-payment": "Delbetaling",
  loan: "Lån",
};

export function isOverdue(deadline: string | Date): boolean {
  return norwegianTime(deadline).endOf("day").isBefore(norwegianTime());
}

function deadlineLabel(book: ActiveCustomerItem): string {
  const date = norwegianTime(book.deadline).format("DD.MM.YYYY");
  return book.type ? `${TYPE_LABELS[book.type]} til ${date}` : `Frist ${date}`;
}

function DeadlineText({ book }: { book: ActiveCustomerItem }) {
  const overdue = isOverdue(book.deadline);
  return (
    <Text size={"sm"} c={overdue ? "red" : "dimmed"} fw={overdue ? 600 : undefined}>
      {deadlineLabel(book)}
    </Text>
  );
}

function OverdueBadge() {
  return (
    <Badge color={"red"} variant={"filled"} size={"sm"} style={{ flexShrink: 0 }}>
      Over frist
    </Badge>
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
    if (index === -1) continue;
    const [peerBook] = pending.splice(index, 1);
    if (peerBook) names.set(book.id, peerBook.personName);
  }
  return names;
}

function BookCards({
  books,
  deliverToNames,
}: {
  books: ActiveCustomerItem[];
  deliverToNames: Map<string, string>;
}) {
  return (
    <Stack gap={"xs"} hiddenFrom={"sm"}>
      {books.map((book) => {
        const deliverToName = deliverToNames.get(book.id);
        return (
          <Card key={book.id} withBorder radius={"md"} padding={"sm"}>
            <Text fw={600} lh={1.3}>
              {book.title}
            </Text>
            {deliverToName && (
              <Group mt={4}>
                <PeerBadge>Leveres til {deliverToName}</PeerBadge>
              </Group>
            )}
            <Group justify={"space-between"} gap={6} mt={4}>
              <Group gap={6}>
                <DeadlineText book={book} />
                {isOverdue(book.deadline) && <OverdueBadge />}
              </Group>
              {book.blid && (
                <Text size={"sm"} c={"dimmed"} ff={"monospace"}>
                  {book.blid}
                </Text>
              )}
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}

function BookTable({
  books,
  deliverToNames,
}: {
  books: ActiveCustomerItem[];
  deliverToNames: Map<string, string>;
}) {
  return (
    <Box visibleFrom={"sm"}>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tittel</Table.Th>
            <Table.Th>Unik ID</Table.Th>
            <Table.Th>Frist</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {books.map((book) => {
            const deliverToName = deliverToNames.get(book.id);
            return (
              <Table.Tr key={book.id}>
                <Table.Td>
                  <Stack gap={2} align={"flex-start"}>
                    <Text fw={500}>{book.title}</Text>
                    {deliverToName && <PeerBadge>Leveres til {deliverToName}</PeerBadge>}
                  </Stack>
                </Table.Td>
                <Table.Td>{book.blid ? <Code>{book.blid}</Code> : "–"}</Table.Td>
                <Table.Td>
                  <Group gap={6} wrap={"nowrap"}>
                    <DeadlineText book={book} />
                    {isOverdue(book.deadline) && <OverdueBadge />}
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

export default function ActiveBooksView({ customerId }: { customerId: string }) {
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
      <Stack gap={"xs"}>
        <Skeleton height={20} width={"40%"} radius={"sm"} />
        <Skeleton height={44} radius={"sm"} />
        <Skeleton height={44} radius={"sm"} />
      </Stack>
    );
  }

  if (isError) {
    return <ErrorAlert>Klarte ikke laste inn kundens bøker.</ErrorAlert>;
  }

  if (books.length === 0) {
    return <InfoAlert>Kunden har ingen aktive bøker.</InfoAlert>;
  }

  const overdueCount = books.filter((book) => isOverdue(book.deadline)).length;
  const deliverToNames = buildDeliverToNames(books, matches ?? [], customerId);

  return (
    <Stack gap={"xs"}>
      <Group gap={"xs"}>
        <Text size={"sm"} c={"dimmed"}>
          {books.length} {books.length === 1 ? "aktiv bok" : "aktive bøker"}
        </Text>
        {overdueCount > 0 && (
          <Badge color={"red"} variant={"light"}>
            {overdueCount} over frist
          </Badge>
        )}
      </Group>
      <BookCards books={books} deliverToNames={deliverToNames} />
      <BookTable books={books} deliverToNames={deliverToNames} />
    </Stack>
  );
}
