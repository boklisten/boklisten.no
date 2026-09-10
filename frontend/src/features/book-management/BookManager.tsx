import type { Item } from "@boklisten/backend/shared/item";
import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgGridReact } from "ag-grid-react";
import { useRef, useState } from "react";

import BookFormModal from "@/features/book-management/BookFormModal";
import type { BookSuggestions } from "@/features/book-management/BookFormModal";
import BookGrid from "@/features/book-management/BookGrid";
import type { BookPatchRequest } from "@/features/book-management/BookGrid";
import BookSelectionBar from "@/features/book-management/BookSelectionBar";
import BookUpload from "@/features/book-management/BookUpload";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification } from "@/shared/utils/notifications";

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter((value) => value.length > 0))].toSorted((a, b) =>
    a.localeCompare(b, "nb"),
  );
}

function suggestionsFrom(items: Item[]): BookSuggestions {
  return {
    subjects: uniqueSorted(items.map((item) => item.info.subject)),
    distributors: uniqueSorted(items.map((item) => item.info.distributor)),
    publishers: uniqueSorted(items.map((item) => item.info.publisher)),
  };
}

export default function BookManager() {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Item[]>([]);
  const gridRef = useRef<AgGridReact<Item>>(null);

  const itemsQuery = api.items.getAllForAdmin.queryOptions();
  const { data: items, isLoading, error } = useQuery(itemsQuery);

  const { mutate: patchBook } = useMutation({
    mutationFn: ({ id, patch }: BookPatchRequest) =>
      client.api.items.update({ params: { id }, body: patch }),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: itemsQuery.queryKey });
      const previous = queryClient.getQueryData(itemsQuery.queryKey);
      queryClient.setQueryData(itemsQuery.queryKey, (current) =>
        current?.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
      return { previous };
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(itemsQuery.queryKey, (current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
    onError: (mutationError, _variables, context) => {
      queryClient.setQueryData(itemsQuery.queryKey, context?.previous);
      showErrorNotification(errorMessage(mutationError, "Klarte ikke lagre endringen"));
    },
  });

  if (error) {
    return <ErrorAlert title="Klarte ikke laste inn bøker">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }

  const allItems = items ?? [];
  const suggestions = suggestionsFrom(allItems);
  const activeCount = allItems.filter((item) => item.active).length;

  function openBookModal(item?: Item) {
    const modalId = modals.open({
      title: item === undefined ? "Legg til bok" : "Endre bok",
      size: "lg",
      children: (
        <BookFormModal
          item={item}
          suggestions={suggestions}
          onClose={() => modals.close(modalId)}
        />
      ),
    });
  }

  return (
    <Stack>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap={4}>
          <Title>Bøker</Title>
          {items !== undefined && (
            <Text size="sm" c="dimmed">
              {activeCount} aktive av {allItems.length} bøker
            </Text>
          )}
        </Stack>
        <Group gap="xs">
          <BookUpload items={allItems} />
          <Button leftSection={<IconPlus size={18} />} onClick={() => openBookModal()}>
            Legg til bok
          </Button>
        </Group>
      </Group>
      <BookGrid
        gridRef={gridRef}
        items={allItems}
        loading={isLoading}
        onPatch={patchBook}
        onEdit={openBookModal}
        onSelectionChange={setSelected}
      />
      <Text size="xs" c="dimmed">
        Tabellen viser bare aktive bøker til du fjerner filteret på Aktiv-kolonnen. Søk med
        filterikonet i kolonnene. Klikk på en pris for å endre den. Enter lagrer og hopper til neste
        bok, Escape angrer. Huk av bøker for å laste dem ned som Excel. Filen kan endres og lastes
        opp igjen.
      </Text>
      <BookSelectionBar selected={selected} onClear={() => gridRef.current?.api.deselectAll()} />
    </Stack>
  );
}
