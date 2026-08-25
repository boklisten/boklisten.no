import { Stack, Table, Text, Tooltip } from "@mantine/core";
import { IconAlertSquareFilled, IconSquareCheckFilled } from "@tabler/icons-react";

import {
  describeObligation,
  isObligationSettled,
  type ViewerObligation,
} from "@/features/matches/forViewer";
import { type ItemStatus, PeerBadge } from "@/shared/components/matches/matches-helper";

function StatusIcon({ fulfilled, label }: { fulfilled: boolean; label: string }) {
  return (
    <Tooltip label={label}>
      <Table.Td>
        {fulfilled ? (
          <IconSquareCheckFilled color={"green"} />
        ) : (
          <IconAlertSquareFilled color={"orange"} />
        )}
      </Table.Td>
    </Tooltip>
  );
}

function TableFrame({ children, hasActions }: { children: React.ReactNode; hasActions?: boolean }) {
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Tittel</Table.Th>
          <Table.Th>Status</Table.Th>
          {hasActions && <Table.Th>Handling</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{children}</Table.Tbody>
    </Table>
  );
}

/**
 * A row's status, and what the tick claims: the reader's own half of the book on the student
 * pages, the whole book on the admin pages — where every book appears exactly once and the tick
 * has to agree with the "N av M bøker overlevert" count above it.
 */
function rowStatus(obligation: ViewerObligation, wholeBook: boolean) {
  if (wholeBook) {
    const settled = isObligationSettled(obligation);
    return {
      fulfilled: settled,
      label: settled ? "Denne boken er overlevert" : "Denne boken er ikke overlevert enda",
    };
  }
  const verb = obligation.side === "deliver" ? "levert" : "mottatt";
  return {
    fulfilled: obligation.fulfilled,
    label: obligation.fulfilled
      ? `Denne boken er registrert som ${verb}`
      : `Denne boken har ikke blitt registrert som ${verb}`,
  };
}

export default function MatchItemTable({
  obligations,
  adminView = false,
}: {
  obligations: ViewerObligation[];
  /**
   * Set on the admin pages: notes speak *about* the parties by name instead of saying "du", and
   * ticks mean whole books rather than the reader's own half.
   */
  adminView?: boolean;
}) {
  return (
    <TableFrame>
      {[...obligations]
        .map((obligation) => ({ obligation, ...rowStatus(obligation, adminView) }))
        .sort((a, b) => Number(a.fulfilled) - Number(b.fulfilled))
        .map(({ obligation, fulfilled, label }) => {
          const note = describeObligation(obligation, adminView);
          return (
            <Table.Tr key={obligation.id}>
              <Table.Td>
                <Stack gap={2}>
                  <Text>{obligation.title}</Text>
                  {note && (
                    <Text size={"xs"} c={"dimmed"}>
                      {note}
                    </Text>
                  )}
                </Stack>
              </Table.Td>
              <StatusIcon fulfilled={fulfilled} label={label} />
            </Table.Tr>
          );
        })}
    </TableFrame>
  );
}

export function ItemStatusTable({
  itemStatuses,
  isSender,
  renderAction,
}: {
  itemStatuses: ItemStatus[];
  isSender: boolean;
  /** Adds a "Handling" column with the returned node per row. */
  renderAction?: (item: ItemStatus) => React.ReactNode;
}) {
  const verb = isSender ? "levert" : "mottatt";
  return (
    <TableFrame hasActions={renderAction !== undefined}>
      {[...itemStatuses]
        .sort((a, b) => Number(a.fulfilled) - Number(b.fulfilled))
        .map((item) => (
          <Table.Tr key={item.id}>
            <Table.Td>
              {item.receiveFromName === undefined ? (
                item.title
              ) : (
                <Stack gap={2} align={"flex-start"}>
                  <Text size={"sm"}>{item.title}</Text>
                  <PeerBadge>Mottas fra {item.receiveFromName}</PeerBadge>
                </Stack>
              )}
            </Table.Td>
            <StatusIcon
              fulfilled={item.fulfilled}
              label={
                item.fulfilled
                  ? `Denne boken er registrert som ${verb}`
                  : `Denne boken har ikke blitt registrert som ${verb}`
              }
            />
            {renderAction && <Table.Td>{renderAction(item)}</Table.Td>}
          </Table.Tr>
        ))}
    </TableFrame>
  );
}
