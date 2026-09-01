import { Stack } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconSum } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { bookCountLabel } from "@/features/branches/branch-books/bookCountLabel";
import BranchBooksCancelModal from "@/features/branches/branch-books/BranchBooksCancelModal";
import BranchBooksDetailsTable from "@/features/branches/branch-books/BranchBooksDetailsTable";
import BranchBooksEditModal from "@/features/branches/branch-books/BranchBooksEditModal";
import BranchBooksTree from "@/features/branches/branch-books/BranchBooksTree";
import type {
  BranchBooksDetailColumn,
  BranchBooksEditKind,
  BranchBooksEditTarget,
  OrderedBookDetail,
} from "@/features/branches/branch-books/types";
import BranchScopeMetrics from "@/shared/components/BranchScopeMetrics";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";
import {
  showErrorNotification,
  showInfoNotification,
  showSuccessNotification,
} from "@/shared/utils/notifications";

const BRANCH_MOVE_NOTE =
  "Hele ordren flyttes til den nye filialen, også eventuelle andre bøker i samme ordre.";

const COLUMNS: BranchBooksDetailColumn<OrderedBookDetail>[] = [
  { header: "Navn", render: (row) => row.customerName ?? "Ukjent kunde" },
  { header: "Fødselsår", render: (row) => row.birthYear ?? "–" },
  { header: "Filialmedlemskap", render: (row) => row.membershipBranchName ?? "–" },
  {
    header: "Bestilt",
    render: (row) =>
      row.orderTime ? norwegianTime(row.orderTime).format("DD.MM.YYYY HH:mm") : "–",
  },
];

function OrderedBookDetails({
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
  onEditRow: (kind: BranchBooksEditKind, row: OrderedBookDetail) => void;
}) {
  const { api } = useApiClient();
  const detailsQuery = useQuery({
    ...api.branchBooks.getOrderedBookDetails.queryOptions({
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
      leafLabel="Bestilt på denne filialen"
      emptyLabel="Ingen av disse bøkene er bestilt direkte fra denne filialen."
      allowCancel
      rowKey={(row) => row.orderItemId}
      onEditRow={onEditRow}
    />
  );
}

function bulkFilter(target: BranchBooksEditTarget, includeDescendants: boolean) {
  return {
    ...(target.filter.deadlines && { deadlines: target.filter.deadlines }),
    ...(target.filter.itemId && { itemId: target.filter.itemId }),
    ...(target.filter.ids && { orderItemIds: target.filter.ids }),
    includeDescendants,
  };
}

export default function OrderedBooksTab({ branchId }: { branchId: string }) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const summaryQuery = useQuery(
    api.branchBooks.getOrderedBooks.queryOptions({ params: { branchId } }),
  );
  const bulkUpdateMutation = useMutation(
    api.branchBooks.bulkUpdateOrderedBooks.mutationOptions({
      onSuccess: () => showSuccessNotification("Bestillingene ble oppdatert"),
      onError: () => showErrorNotification("Klarte ikke oppdatere bestillingene"),
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: api.branchBooks.getOrderedBooks.pathKey() }),
          queryClient.invalidateQueries({
            queryKey: api.branchBooks.getOrderedBookDetails.pathKey(),
          }),
        ]),
    }),
  );
  const cancelMutation = useMutation(
    api.branchBooks.cancelOrderedBooks.mutationOptions({
      onSuccess: (result) => {
        if (!result) {
          return;
        }
        if (result.cancelledBooks > 0) {
          showSuccessNotification(`Avbestilte ${bookCountLabel(result.cancelledBooks)}`);
        }
        if (result.skippedBooks > 0) {
          showInfoNotification(
            `${bookCountLabel(result.skippedBooks)} ble ikke avbestilt fordi bestillingen er betalt`,
          );
        }
      },
      onError: () => showErrorNotification("Klarte ikke avbestille bestillingene"),
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: api.branchBooks.getOrderedBooks.pathKey() }),
          queryClient.invalidateQueries({
            queryKey: api.branchBooks.getOrderedBookDetails.pathKey(),
          }),
        ]),
    }),
  );

  function openEdit(kind: BranchBooksEditKind, target: BranchBooksEditTarget) {
    if (kind === "cancel") {
      const modalId = modals.open({
        title: "Avbestill bestillinger",
        children: (
          <BranchBooksCancelModal
            target={target}
            onClose={() => modals.close(modalId)}
            onSubmit={({ notifyCustomers, includeDescendants }) =>
              cancelMutation.mutateAsync({
                params: { branchId },
                body: { filter: bulkFilter(target, includeDescendants), notifyCustomers },
              })
            }
          />
        ),
      });
      return;
    }
    const modalId = modals.open({
      title: kind === "deadline" ? "Endre frist" : "Flytt til annen filial",
      children: (
        <BranchBooksEditModal
          kind={kind}
          target={target}
          branchId={branchId}
          branchMoveNote={BRANCH_MOVE_NOTE}
          onClose={() => modals.close(modalId)}
          onSubmit={(update, includeDescendants) =>
            bulkUpdateMutation.mutateAsync({
              params: { branchId },
              body: { filter: bulkFilter(target, includeDescendants), update },
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
        directLabel="Bestilt på denne filialen"
        indirectLabel="Bestilt på underliggende filialer"
      />
      <BranchBooksTree
        summary={summaryQuery.data}
        isLoading={summaryQuery.isLoading}
        isError={summaryQuery.isError}
        treeLabel="Bestilte bøker etter frist"
        emptyLabel="Ingen bestilte bøker på denne filialen."
        allowCancel
        onEdit={openEdit}
        renderDetails={(deadlines, itemId, enabled) => (
          <OrderedBookDetails
            branchId={branchId}
            deadlines={deadlines}
            itemId={itemId}
            enabled={enabled}
            onEditRow={(kind, row) =>
              openEdit(kind, {
                description: `${row.customerName ?? "ukjent kunde"} sin bestilling`,
                filter: { ids: [row.orderItemId] },
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
