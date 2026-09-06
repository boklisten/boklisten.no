import type { Branch } from "@boklisten/backend/shared/branch";
import { Box, Card, Group, Stack, Table, Text, Tooltip } from "@mantine/core";
import { IconAlertSquareFilled, IconSquareCheckFilled } from "@tabler/icons-react";
import type { ReactNode } from "react";

import type { OpenOrderInfo } from "@/features/customer-search/handoutBooks";
import OrderItemDeadlineChip from "@/features/customer-search/OrderItemDeadlineChip";
import OrderBranchChip from "@/features/order-history/OrderBranchChip";
import { PeerBadge } from "@/shared/components/matches/matches-helper";
import type { ItemStatus } from "@/shared/components/matches/matches-helper";
import { StatusIcon } from "@/shared/components/matches/MatchItemTable";

function statusLabel(row: ItemStatus): string {
  return row.fulfilled
    ? "Denne boken er registrert som levert"
    : "Denne boken har ikke blitt registrert som levert";
}

/**
 * The order's branch as a chip, editable until the book is handed out and the branch moves onto
 * the customer item. The branch is the order's, so changing it moves every book in that order.
 */
function branchChip(
  row: ItemStatus,
  orderInfo: OpenOrderInfo | undefined,
  branches: Branch[] | undefined,
  onChanged: () => void,
): ReactNode | null {
  const branchName = branches?.find((branch) => branch.id === orderInfo?.branchId)?.name;
  if (row.fulfilled || !orderInfo || branchName === undefined) {
    return null;
  }
  return (
    <OrderBranchChip
      orderId={orderInfo.orderId}
      branchId={orderInfo.branchId}
      branchName={branchName}
      onChanged={onChanged}
    />
  );
}

/** The ordered period as a chip, editable until the book is handed out. */
function deadlineChip(
  row: ItemStatus,
  orderInfo: OpenOrderInfo | undefined,
  onChanged: () => void,
): ReactNode | null {
  if (row.fulfilled || !orderInfo || orderInfo.deadline === undefined) {
    return null;
  }
  return (
    <OrderItemDeadlineChip
      orderId={orderInfo.orderId}
      itemId={row.id}
      type={orderInfo.type}
      deadline={orderInfo.deadline}
      onChanged={onChanged}
    />
  );
}

/**
 * Every book the customer is due to get, as a table on wide screens and cards on narrow ones,
 * the same way the customer's active books are shown. Unhanded rows sort first: they are the
 * ones the stand is working on.
 */
export default function HandoutBooksTable({
  rows,
  openOrderInfo,
  branches,
  onChanged,
  renderAction,
}: {
  rows: ItemStatus[];
  openOrderInfo: Map<string, OpenOrderInfo>;
  branches: Branch[] | undefined;
  /** Called after a branch or deadline was changed, so the lists behind the rows refresh. */
  onChanged: () => void;
  /** The row's action, or null when there is none. */
  renderAction: (row: ItemStatus) => ReactNode;
}) {
  const sorted = rows.toSorted((a, b) => Number(a.fulfilled) - Number(b.fulfilled));
  return (
    <>
      <Stack gap="xs" hiddenFrom="sm">
        {sorted.map((row) => {
          const orderInfo = openOrderInfo.get(row.id);
          const branch = branchChip(row, orderInfo, branches, onChanged);
          const deadline = deadlineChip(row, orderInfo, onChanged);
          return (
            <Card key={row.id} withBorder radius="md" padding="sm">
              <Text fw={600} lh={1.3}>
                {row.title}
              </Text>
              {row.receiveFromName !== undefined && (
                <Group mt={4}>
                  <PeerBadge>Mottas fra {row.receiveFromName}</PeerBadge>
                </Group>
              )}
              {(branch !== null || deadline !== null) && (
                <Group gap={6} mt={6}>
                  {branch}
                  {deadline}
                </Group>
              )}
              <Group justify="space-between" mt="sm">
                <Tooltip label={statusLabel(row)}>
                  <Group gap={6} wrap="nowrap">
                    {row.fulfilled ? (
                      <IconSquareCheckFilled color="green" aria-hidden />
                    ) : (
                      <IconAlertSquareFilled color="orange" aria-hidden />
                    )}
                    <Text size="sm">{row.fulfilled ? "Levert" : "Ikke levert"}</Text>
                  </Group>
                </Tooltip>
                {renderAction(row)}
              </Group>
            </Card>
          );
        })}
      </Stack>
      <Box visibleFrom="sm">
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tittel</Table.Th>
              <Table.Th>Filial</Table.Th>
              <Table.Th>Frist</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Handling</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map((row) => {
              const orderInfo = openOrderInfo.get(row.id);
              return (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <Stack gap={2} align="flex-start">
                      <Text fw={500}>{row.title}</Text>
                      {row.receiveFromName !== undefined && (
                        <PeerBadge>Mottas fra {row.receiveFromName}</PeerBadge>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>{branchChip(row, orderInfo, branches, onChanged) ?? "–"}</Table.Td>
                  <Table.Td>{deadlineChip(row, orderInfo, onChanged) ?? "–"}</Table.Td>
                  <StatusIcon fulfilled={row.fulfilled} label={statusLabel(row)} />
                  <Table.Td>{renderAction(row)}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>
    </>
  );
}
