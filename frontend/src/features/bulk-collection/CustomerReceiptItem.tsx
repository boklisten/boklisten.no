import type { CustomerCollectionReceipt } from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import {
  AccordionControl,
  AccordionItem,
  AccordionPanel,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";

import { formatDeadline } from "@/features/bulk-collection/deadline";

export default function CustomerReceiptItem({ receipt }: { receipt: CustomerCollectionReceipt }) {
  return (
    <AccordionItem value={receipt.customerId}>
      <AccordionControl>
        {receipt.customerName} ({receipt.deliveredCount}/{receipt.totalActiveCount} bøker levert)
      </AccordionControl>
      <AccordionPanel>
        <Stack>
          <Title order={4}>Leverte bøker</Title>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tidspunkt</Table.Th>
                <Table.Th>Ordrenummer</Table.Th>
                <Table.Th>Tittel</Table.Th>
                <Table.Th>Frist</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {receipt.collectedBooks.map((book, index) => (
                <Table.Tr key={`${book.orderId}-${index}`}>
                  <Table.Td>{book.time}</Table.Td>
                  <Table.Td>{book.orderId}</Table.Td>
                  <Table.Td>{book.title}</Table.Td>
                  <Table.Td>{formatDeadline(book.deadline)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Title order={4}>Gjenværende bøker</Title>
          {receipt.remainingBooks.length === 0 ? (
            <Text>Kunden har levert alle sine bøker.</Text>
          ) : (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tittel</Table.Th>
                  <Table.Th>Frist</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {receipt.remainingBooks.map((book, index) => (
                  <Table.Tr key={`${book.title}-${index}`}>
                    <Table.Td>{book.title}</Table.Td>
                    <Table.Td>{formatDeadline(book.deadline)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </AccordionPanel>
    </AccordionItem>
  );
}
