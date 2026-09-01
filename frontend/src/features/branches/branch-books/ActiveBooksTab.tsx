import { Code, Stack } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconSum } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import BranchBooksDetailsTable from "@/features/branches/branch-books/BranchBooksDetailsTable";
import BranchBooksEditModal from "@/features/branches/branch-books/BranchBooksEditModal";
import BranchBooksTree from "@/features/branches/branch-books/BranchBooksTree";
import type {
  ActiveBookDetail,
  BranchBooksDetailColumn,
  BranchBooksEditKind,
  BranchBooksEditTarget,
} from "@/features/branches/branch-books/types";
import BranchScopeMetrics from "@/shared/components/BranchScopeMetrics";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const COLUMNS: BranchBooksDetailColumn<ActiveBookDetail>[] = [
  { header: "Navn", render: (row) => row.customerName ?? "Ukjent kunde" },
  { header: "Fødselsår", render: (row) => row.birthYear ?? "–" },
  { header: "Filialmedlemskap", render: (row) => row.membershipBranchName ?? "–" },
  { header: "BL-ID", render: (row) => (row.blid ? <Code>{row.blid}</Code> : "–") },
  {
    header: "Utdelt",
    render: (row) =>
      row.handoutTime ? norwegianTime(row.handoutTime).format("DD.MM.YYYY HH:mm") : "–",
  },
];

function ActiveBookDetails({
  branchId,
  deadlines,
  itemId,
  enabled,
  onEditRow,
}: {
  branchId: string;
  deadlines: string[];
  itemId: string;
  enabled: boolean;
  onEditRow: (kind: BranchBooksEditKind, row: ActiveBookDetail) => void;
}) {
  const { api } = useApiClient();
  const detailsQuery = useQuery({
    ...api.branchBooks.getActiveBookDetails.queryOptions({
      params: { branchId },
      query: { deadlines, itemId },
    }),
    enabled,
  });
  return (
    <BranchBooksDetailsTable
      rows={detailsQuery.data}
      isLoading={detailsQuery.isLoading}
      isError={detailsQuery.isError}
      columns={COLUMNS}
      leafLabel="Utdelt på denne filialen"
      emptyLabel="Ingen av disse bøkene er delt ut direkte på denne filialen."
      rowKey={(row) => row.customerItemId}
      onEditRow={onEditRow}
    />
  );
}

export default function ActiveBooksTab({ branchId }: { branchId: string }) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const summaryQuery = useQuery(
    api.branchBooks.getActiveBooks.queryOptions({ params: { branchId } }),
  );
  const bulkUpdateMutation = useMutation(
    api.branchBooks.bulkUpdateActiveBooks.mutationOptions({
      onSuccess: () => showSuccessNotification("Bøkene ble oppdatert"),
      onError: () => showErrorNotification("Klarte ikke oppdatere bøkene"),
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: api.branchBooks.getActiveBooks.pathKey() }),
          queryClient.invalidateQueries({
            queryKey: api.branchBooks.getActiveBookDetails.pathKey(),
          }),
        ]),
    }),
  );

  function openEdit(kind: BranchBooksEditKind, target: BranchBooksEditTarget) {
    if (kind === "cancel") {
      return;
    } // Active books cannot be cancelled
    const modalId = modals.open({
      title: kind === "deadline" ? "Endre frist" : "Flytt til annen filial",
      children: (
        <BranchBooksEditModal
          kind={kind}
          target={target}
          branchId={branchId}
          onClose={() => modals.close(modalId)}
          onSubmit={(update, includeDescendants) =>
            bulkUpdateMutation.mutateAsync({
              params: { branchId },
              body: {
                filter: {
                  ...(target.filter.deadlines && { deadlines: target.filter.deadlines }),
                  ...(target.filter.itemId && { itemId: target.filter.itemId }),
                  ...(target.filter.ids && { customerItemIds: target.filter.ids }),
                  includeDescendants,
                },
                update,
              },
            })
          }
        />
      ),
    });
  }

  return (
    <Stack>
      <BranchScopeMetrics
        isLoading={summaryQuery.isLoading}
        total={summaryQuery.data?.total}
        direct={summaryQuery.data?.direct}
        indirect={summaryQuery.data?.indirect}
        totalIcon={<IconSum size={18} />}
        directLabel="Utdelt på denne filialen"
        indirectLabel="Utdelt på underliggende filialer"
      />
      <BranchBooksTree
        summary={summaryQuery.data}
        isLoading={summaryQuery.isLoading}
        isError={summaryQuery.isError}
        treeLabel="Aktive bøker etter frist"
        emptyLabel="Ingen aktive bøker på denne filialen."
        onEdit={openEdit}
        renderDetails={(deadlines, itemId, enabled) => (
          <ActiveBookDetails
            branchId={branchId}
            deadlines={deadlines}
            itemId={itemId}
            enabled={enabled}
            onEditRow={(kind, row) =>
              openEdit(kind, {
                description: `${row.customerName ?? "ukjent kunde"} sin bok`,
                filter: { ids: [row.customerItemId] },
                direct: 1,
                total: 1,
                allowDescendants: false,
              })
            }
          />
        )}
      />
    </Stack>
  );
}
