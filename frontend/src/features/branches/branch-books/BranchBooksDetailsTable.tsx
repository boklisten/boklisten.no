import { Alert, Badge, Group, Skeleton, Stack, Table, Text } from "@mantine/core";
import { IconAlertTriangle, IconBuildingStore } from "@tabler/icons-react";
import { ReactNode } from "react";

import BranchBooksEditMenu from "@/features/branches/branch-books/BranchBooksEditMenu";
import {
  BranchBooksDetailColumn,
  BranchBooksEditKind,
} from "@/features/branches/branch-books/types";

/**
 * The leaf level of the tree: the individual books belonging directly to the selected branch.
 * Books at descendant branches are counted in the badges above but intentionally not listed here.
 */
export default function BranchBooksDetailsTable<TDetail>({
  rows,
  isLoading,
  isError,
  columns,
  leafLabel,
  emptyLabel,
  allowCancel,
  rowKey,
  onEditRow,
}: {
  rows: TDetail[] | undefined;
  isLoading: boolean;
  isError: boolean;
  columns: BranchBooksDetailColumn<TDetail>[];
  /** e.g. "Utdelt på denne filialen" */
  leafLabel: string;
  /** Shown when every book in the group belongs to descendant branches */
  emptyLabel: string;
  /** Adds the destructive "Avbestill" entry to the row menus; only ordered books can be cancelled */
  allowCancel?: boolean;
  rowKey: (row: TDetail) => string;
  onEditRow: (kind: BranchBooksEditKind, row: TDetail) => void;
}): ReactNode {
  if (isLoading) {
    return (
      <Stack gap={"xs"}>
        <Skeleton h={"md"} w={"50%"} />
        <Skeleton h={"xl"} />
        <Skeleton h={"xl"} />
      </Stack>
    );
  }
  if (isError) {
    return (
      <Alert color={"red"} icon={<IconAlertTriangle />}>
        Klarte ikke laste inn bøkene. Lukk og åpne boktittelen for å prøve igjen.
      </Alert>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <Alert color={"gray"} icon={<IconBuildingStore />}>
        {emptyLabel}
      </Alert>
    );
  }
  return (
    <Stack gap={"xs"}>
      <Group gap={"xs"}>
        <IconBuildingStore size={16} />
        <Text size={"sm"} fw={"bold"}>
          {leafLabel}
        </Text>
        <Badge variant={"light"} color={"blue"}>
          {rows.length}
        </Badge>
      </Group>
      <Table.ScrollContainer minWidth={560}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => (
                <Table.Th key={column.header}>{column.header}</Table.Th>
              ))}
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={rowKey(row)}>
                {columns.map((column) => (
                  <Table.Td key={column.header}>{column.render(row)}</Table.Td>
                ))}
                <Table.Td align={"right"}>
                  <BranchBooksEditMenu
                    label={"Endre bok"}
                    allowCancel={allowCancel}
                    onEdit={(kind) => onEditRow(kind, row)}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
