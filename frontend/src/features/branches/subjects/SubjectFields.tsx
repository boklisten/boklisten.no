import { CloseButton, Group, MultiSelect, Paper, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { formValueToBook, PAYMENT_OPTIONS } from "@/features/branches/subjects/subjectOptions";
import type { SubjectBookFormValue } from "@/features/branches/subjects/subjectOptions";
import { commitValue, withFieldGroup } from "@/shared/hooks/form";
import { api } from "@/shared/utils/apiClient";

export interface SubjectFieldValues {
  name: string;
  externalName: string;
  books: SubjectBookFormValue[];
}

export const subjectFieldDefaultValues: SubjectFieldValues = {
  name: "",
  externalName: "",
  books: [],
};

function SubjectBookSelect({
  value,
  onChange,
}: {
  value: SubjectBookFormValue[];
  onChange: (books: SubjectBookFormValue[]) => void;
}) {
  const { data: items } = useQuery(api.items.index.queryOptions());

  return (
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
          const isbn = items?.find((item) => item.id === option.value)?.isbn?.toString();
          return isbn?.includes(search.trim()) ?? false;
        })
      }
      value={value.map((book) => book.item.id)}
      onChange={(itemIds) =>
        onChange(
          itemIds.map(
            (itemId) =>
              value.find((book) => book.item.id === itemId) ?? {
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
  );
}

/** The name, external name and books of a subject, shared by the create modal and the inline editor */
const SubjectFields = withFieldGroup({
  defaultValues: subjectFieldDefaultValues,
  render: ({ group }) => (
    <Stack>
      <group.AppField
        name="name"
        validators={{
          onChange: ({ value }) => (value.trim().length === 0 ? "Fyll inn et navn" : undefined),
        }}
      >
        {(field) => (
          <field.TextField
            label="Navn"
            description="Det kundene ser når de bestiller bøker."
            placeholder="Kjemi 2"
            required
          />
        )}
      </group.AppField>
      <group.AppField name="externalName">
        {(field) => (
          <field.TextField
            label="Eksternt navn"
            description="Fagnavnet slik det står i skolens fagvalg-fil. La feltet stå tomt hvis det er det samme som navnet."
            placeholder="REA3012 Kjemi 2"
          />
        )}
      </group.AppField>
      <group.AppField name="books">
        {(field) => (
          <SubjectBookSelect
            value={field.state.value}
            onChange={(books) => commitValue(field, books)}
          />
        )}
      </group.AppField>
      <group.AppField name="books" mode="array">
        {(field) =>
          field.state.value.map((book, i) => (
            <Paper key={book.item.id} withBorder p="sm">
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={500} size="sm">
                    {book.item.title}
                  </Text>
                  <CloseButton
                    aria-label={`Fjern «${book.item.title}»`}
                    onClick={() => {
                      field.removeValue(i);
                      field.handleBlur();
                    }}
                  />
                </Group>
                <group.AppField name={`books[${i}].ordering`}>
                  {(subField) => (
                    <subField.ChipsField label="Bestilling" data={[...PAYMENT_OPTIONS]} />
                  )}
                </group.AppField>
                <group.AppField name={`books[${i}].atBranch`}>
                  {(subField) => (
                    <subField.ChipsField label="På filial" data={[...PAYMENT_OPTIONS]} />
                  )}
                </group.AppField>
              </Stack>
            </Paper>
          ))
        }
      </group.AppField>
    </Stack>
  ),
});

export default SubjectFields;

/** The subject as the create and update endpoints take it; a blank external name is sent as null */
export function subjectFieldsBody(values: SubjectFieldValues) {
  return {
    name: values.name,
    externalName: values.externalName.trim() || null,
    books: values.books.map(formValueToBook),
  };
}
