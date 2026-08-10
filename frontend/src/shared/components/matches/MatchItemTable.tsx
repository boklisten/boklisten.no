import { Stack, Table, Text, Tooltip } from "@mantine/core";
import { IconAlertSquareFilled, IconSquareCheckFilled } from "@tabler/icons-react";

import { describeObligation, type ViewerObligation } from "@/features/matches/forViewer";
import type { ItemStatus } from "@/shared/components/matches/matches-helper";

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

function TableFrame({ children }: { children: React.ReactNode }) {
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Tittel</Table.Th>
          <Table.Th>Status</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{children}</Table.Tbody>
    </Table>
  );
}

export default function MatchItemTable({
  obligations,
  viewerName,
}: {
  obligations: ViewerObligation[];
  viewerName?: string;
}) {
  return (
    <TableFrame>
      {[...obligations]
        .sort((a, b) => Number(a.fulfilled) - Number(b.fulfilled))
        .map((obligation) => {
          const note = describeObligation(obligation, viewerName);
          const verb = obligation.side === "deliver" ? "levert" : "mottatt";
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
              <StatusIcon
                fulfilled={obligation.fulfilled}
                label={
                  obligation.fulfilled
                    ? `Denne boken er registrert som ${verb}`
                    : `Denne boken har ikke blitt registrert som ${verb}`
                }
              />
            </Table.Tr>
          );
        })}
    </TableFrame>
  );
}

export function ItemStatusTable({
  itemStatuses,
  isSender,
}: {
  itemStatuses: ItemStatus[];
  isSender: boolean;
}) {
  const verb = isSender ? "levert" : "mottatt";
  return (
    <TableFrame>
      {[...itemStatuses]
        .sort((a, b) => Number(a.fulfilled) - Number(b.fulfilled))
        .map((item) => (
          <Table.Tr key={item.id}>
            <Table.Td>{item.title}</Table.Td>
            <StatusIcon
              fulfilled={item.fulfilled}
              label={
                item.fulfilled
                  ? `Denne boken er registrert som ${verb}`
                  : `Denne boken har ikke blitt registrert som ${verb}`
              }
            />
          </Table.Tr>
        ))}
    </TableFrame>
  );
}
