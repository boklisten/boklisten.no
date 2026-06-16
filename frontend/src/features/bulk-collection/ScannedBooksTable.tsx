import type { ScannedBook } from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { Button, Group, Table, Text, Tooltip } from "@mantine/core";
import { IconAlertTriangle, IconLock } from "@tabler/icons-react";

import { formatDeadline, isOverdue } from "@/features/bulk-collection/deadline";

const LOCKED_TOOLTIP =
  "Denne boka er låst til en overlevering og kan ikke leveres på stand — eleven må overlevere den til en annen elev.";

export default function ScannedBooksTable({
  books,
  onRemove,
}: {
  books: ScannedBook[];
  onRemove: (blid: string) => void;
}) {
  return (
    <Table.ScrollContainer minWidth={500}>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tittel</Table.Th>
            <Table.Th>Utdelt på</Table.Th>
            <Table.Th>Frist</Table.Th>
            <Table.Th>Lånt av</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {books.map((book) => (
            <Table.Tr key={book.blid}>
              <Table.Td>
                <Group gap={"xs"} wrap={"nowrap"}>
                  {book.lockedToMatch && (
                    <Tooltip label={LOCKED_TOOLTIP} multiline w={260}>
                      <IconLock color={"red"} size={18} />
                    </Tooltip>
                  )}
                  <Text>{book.title}</Text>
                </Group>
              </Table.Td>
              <Table.Td>{book.handoutBranchName}</Table.Td>
              <Table.Td>
                <Group gap={4} wrap={"nowrap"}>
                  {isOverdue(book.deadline) && (
                    <Tooltip label={"Fristen har utløpt!"}>
                      <IconAlertTriangle color={"red"} size={18} />
                    </Tooltip>
                  )}
                  <Text>{formatDeadline(book.deadline)}</Text>
                </Group>
              </Table.Td>
              <Table.Td>{book.customerName}</Table.Td>
              <Table.Td>
                <Button
                  variant={"subtle"}
                  color={"red"}
                  size={"compact-sm"}
                  onClick={() => onRemove(book.blid)}
                >
                  Fjern
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
