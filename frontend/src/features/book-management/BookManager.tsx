import type { Item } from "@boklisten/backend/shared/item";
import { Button, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import BookFormModal from "@/features/book-management/BookFormModal";
import type { BookSuggestions } from "@/features/book-management/BookFormModal";
import BookGrid from "@/features/book-management/BookGrid";
import type { BookPatchRequest } from "@/features/book-management/BookGrid";
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
  const [search, setSearch] = useState("");

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
        <Button leftSection={<IconPlus size={18} />} onClick={() => openBookModal()}>
          Legg til bok
        </Button>
      </Group>
      <TextInput
        aria-label="Søk etter bok"
        placeholder="Søk på tittel, ISBN, fag eller forlag"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        maw={480}
      />
      <BookGrid
        items={allItems}
        loading={isLoading}
        quickFilterText={search}
        onPatch={patchBook}
        onEdit={openBookModal}
      />
      <Text size="xs" c="dimmed">
        Klikk på en pris for å endre den. Enter lagrer og hopper til neste bok, Escape angrer.
      </Text>
    </Stack>
  );
}
