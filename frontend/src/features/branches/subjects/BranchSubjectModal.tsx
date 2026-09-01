import { Button, Group, MultiSelect, Paper, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bookToFormValue,
  formValueToBook,
  PAYMENT_OPTIONS,
} from "@/features/branches/subjects/subjectOptions";
import type {
  BranchSubject,
  SubjectBookFormValue,
} from "@/features/branches/subjects/subjectOptions";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export function BranchSubjectModal({
  branchId,
  modalId,
  existingSubject,
}: {
  branchId: string;
  modalId: string;
  existingSubject?: BranchSubject;
}) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const { data: items } = useQuery(api.items.get.queryOptions());

  const mutationOptions = {
    onSuccess: () => {
      showSuccessNotification(existingSubject ? "Faget ble lagret!" : "Faget ble opprettet!");
      modals.close(modalId);
    },
    onError: (error: unknown) =>
      showErrorNotification(errorMessage(error, "Klarte ikke lagre faget")),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: api.branchSubjects.getSubjects.pathKey(),
      }),
  };
  const createMutation = useMutation(
    api.branchSubjects.createSubject.mutationOptions(mutationOptions),
  );
  const updateMutation = useMutation(
    api.branchSubjects.updateSubject.mutationOptions(mutationOptions),
  );

  const form = useAppForm({
    defaultValues: {
      name: existingSubject?.name ?? "",
      externalName: existingSubject?.externalName ?? "",
      books: existingSubject?.books.map(bookToFormValue) ?? ([] as SubjectBookFormValue[]),
    },
    onSubmit: ({ value }) => {
      const body = {
        name: value.name,
        externalName: value.externalName,
        books: value.books.map(formValueToBook),
      };
      if (existingSubject) {
        updateMutation.mutate({
          params: { branchId, subjectId: String(existingSubject.id) },
          body,
        });
      } else {
        createMutation.mutate({ params: { branchId }, body });
      }
    },
  });

  return (
    <Stack>
      <form.AppField
        name="name"
        validators={{
          onChange: ({ value }) => (value.trim().length === 0 ? "Fyll inn et navn" : undefined),
        }}
      >
        {(field) => (
          <field.TextField
            label="Navn"
            description="Det kundene ser når de bestiller bøker"
            required
          />
        )}
      </form.AppField>
      <form.AppField
        name="externalName"
        validators={{
          onChange: ({ value }) =>
            value.trim().length === 0 ? "Fyll inn et eksternt navn" : undefined,
        }}
      >
        {(field) => (
          <field.TextField
            label="Eksternt navn"
            description="Fagnavnet slik det står i skolens fagvalg-fil"
            required
          />
        )}
      </form.AppField>
      <form.AppField name="books">
        {(field) => (
          <MultiSelect
            label="Bøker"
            placeholder="Velg bøker"
            searchable
            clearable
            description="Søk etter tittel eller ISBN. Et fag kan også være uten bøker."
            data={items?.map((item) => ({ label: item.title, value: item.id })) ?? []}
            filter={({ options, search }) =>
              options.filter((option) => {
                if (!("value" in option)) {
                  return false;
                }
                if (option.label.toLowerCase().trim().includes(search.toLowerCase().trim())) {
                  return true;
                }
                const isbn = items?.find((item) => item.id === option.value)?.info.isbn.toString();
                return isbn?.includes(search.trim()) ?? false;
              })
            }
            value={field.state.value.map((book) => book.item.id)}
            onChange={(itemIds) =>
              field.handleChange(
                itemIds.map(
                  (itemId) =>
                    field.state.value.find((book) => book.item.id === itemId) ?? {
                      item: {
                        id: itemId,
                        title: items?.find((item) => item.id === itemId)?.title ?? "",
                      },
                      ordering: [],
                      atBranch: [],
                    },
                ),
              )
            }
          />
        )}
      </form.AppField>
      <form.AppField name="books" mode="array">
        {(field) =>
          field.state.value.map((book, i) => (
            <Paper key={book.item.id} withBorder p="sm">
              <Stack gap="xs">
                <Text fw={500} size="sm">
                  {book.item.title}
                </Text>
                <form.AppField name={`books[${i}].ordering`}>
                  {(subField) => (
                    <subField.ChipsField label="Bestilling" data={[...PAYMENT_OPTIONS]} />
                  )}
                </form.AppField>
                <form.AppField name={`books[${i}].atBranch`}>
                  {(subField) => (
                    <subField.ChipsField label="På filial" data={[...PAYMENT_OPTIONS]} />
                  )}
                </form.AppField>
              </Stack>
            </Paper>
          ))
        }
      </form.AppField>
      <Group justify="right" mt="md">
        <Button variant="outline" onClick={() => modals.close(modalId)}>
          Avbryt
        </Button>
        <Button
          bg="green"
          onClick={form.handleSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
        >
          {existingSubject ? "Lagre" : "Opprett"}
        </Button>
      </Group>
    </Stack>
  );
}
