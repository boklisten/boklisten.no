import type { ActiveCustomerItem } from "@boklisten/backend/shared/customer-item/active-customer-item";
import type { CustomerItemType } from "@boklisten/backend/shared/customer-item/customer-item-type";
import { Badge, Box, Card, Code, Group, Skeleton, Stack, Table, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
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

function BookCards({ books }: { books: ActiveCustomerItem[] }) {
  return (
    <Stack gap={"xs"} hiddenFrom={"sm"}>
      {books.map((book) => (
        <Card key={book.id} withBorder radius={"md"} padding={"sm"}>
          <Text fw={600} lh={1.3}>
            {book.title}
          </Text>
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
      ))}
    </Stack>
  );
}

function BookTable({ books }: { books: ActiveCustomerItem[] }) {
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
          {books.map((book) => (
            <Table.Tr key={book.id}>
              <Table.Td>
                <Text fw={500}>{book.title}</Text>
              </Table.Td>
              <Table.Td>{book.blid ? <Code>{book.blid}</Code> : "–"}</Table.Td>
              <Table.Td>
                <Group gap={6} wrap={"nowrap"}>
                  <DeadlineText book={book} />
                  {isOverdue(book.deadline) && <OverdueBadge />}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
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
      <BookCards books={books} />
      <BookTable books={books} />
    </Stack>
  );
}
