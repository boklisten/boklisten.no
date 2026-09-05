import type { Item } from "@boklisten/backend/shared/item";
import { Button, Group, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export interface BookSuggestions {
  subjects: string[];
  distributors: string[];
  publishers: string[];
}

interface BookFormValues {
  title: string;
  isbn: number;
  subject: string;
  year: number;
  price: number;
  weight: number;
  distributor: string;
  discountPercent: number;
  publisher: string;
  active: boolean;
  buyback: boolean;
}

function initialValues(item: Item | undefined): BookFormValues {
  return {
    title: item?.title ?? "",
    isbn: item?.info.isbn ?? 0,
    subject: item?.info.subject ?? "",
    year: item?.info.year ?? new Date().getFullYear(),
    price: item?.price ?? 0,
    weight: Number(item?.info.weight ?? 0),
    distributor: item?.info.distributor ?? "",
    discountPercent: Math.round((item?.info.discount ?? 0) * 100),
    publisher: item?.info.publisher ?? "",
    active: item?.active ?? true,
    buyback: item?.buyback ?? false,
  };
}

function toPayload(values: BookFormValues) {
  return {
    title: values.title.trim(),
    isbn: values.isbn,
    subject: values.subject.trim(),
    year: values.year,
    price: values.price,
    weight: values.weight,
    distributor: values.distributor.trim(),
    discount: values.discountPercent / 100,
    publisher: values.publisher.trim(),
    active: values.active,
    buyback: values.buyback,
  };
}

type BookPayload = ReturnType<typeof toPayload>;

function requiredText(value: string, label: string) {
  return value.trim().length === 0 ? `${label} mangler` : null;
}

export default function BookFormModal({
  item,
  suggestions,
  onClose,
}: {
  item?: Item;
  suggestions: BookSuggestions;
  onClose: () => void;
}) {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const saveBook = useMutation({
    mutationFn: (body: BookPayload) =>
      item === undefined
        ? client.api.items.create({ body })
        : client.api.items.update({ params: { id: item.id }, body }),
    onSuccess: () => {
      showSuccessNotification(item === undefined ? "Boka ble lagt til" : "Boka ble lagret");
      onClose();
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke lagre boka")),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: api.items.getAllForAdmin.pathKey() }),
  });

  const form = useAppForm({
    defaultValues: initialValues(item),
    onSubmit: ({ value }) => saveBook.mutate(toPayload(value)),
  });

  const history = Object.entries(item?.info.price ?? {}).toSorted(([a], [b]) => b.localeCompare(a));

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <form.AppField
          name="title"
          validators={{ onSubmit: ({ value }) => requiredText(value, "Tittel") }}
        >
          {(field) => <field.TextField label="Tittel" required data-autofocus />}
        </form.AppField>
        <form.AppField
          name="isbn"
          validators={{
            onSubmit: ({ value }) =>
              /^(?:\d{10}|\d{13})$/.test(String(value)) ? null : "ISBN må ha 10 eller 13 siffer",
          }}
        >
          {(field) => (
            <field.NumberField
              label="ISBN"
              required
              hideControls
              allowDecimal={false}
              allowNegative={false}
              thousandSeparator=""
            />
          )}
        </form.AppField>
        <form.AppField
          name="subject"
          validators={{ onSubmit: ({ value }) => requiredText(value, "Fag") }}
        >
          {(field) => <field.AutocompleteField label="Fag" required data={suggestions.subjects} />}
        </form.AppField>
        <form.AppField
          name="year"
          validators={{
            onSubmit: ({ value }) =>
              value >= 1900 && value <= 2100 ? null : "Utgivelsesår må være et gyldig årstall",
          }}
        >
          {(field) => (
            <field.NumberField
              label="Utgivelsesår"
              required
              hideControls
              allowDecimal={false}
              thousandSeparator=""
            />
          )}
        </form.AppField>
        <form.AppField
          name="price"
          validators={{
            onSubmit: ({ value }) => (value >= 0 ? null : "Pris kan ikke være negativ"),
          }}
        >
          {(field) => (
            <field.NumberField
              label="Pris"
              required
              hideControls
              allowDecimal={false}
              allowNegative={false}
              suffix=" kr"
            />
          )}
        </form.AppField>
        <form.AppField
          name="weight"
          validators={{
            onSubmit: ({ value }) => (value >= 0 ? null : "Vekt kan ikke være negativ"),
          }}
        >
          {(field) => (
            <field.NumberField
              label="Vekt"
              required
              hideControls
              allowNegative={false}
              decimalScale={3}
              suffix=" kg"
            />
          )}
        </form.AppField>
        <form.AppField
          name="distributor"
          validators={{ onSubmit: ({ value }) => requiredText(value, "Distributør") }}
        >
          {(field) => (
            <field.AutocompleteField label="Distributør" required data={suggestions.distributors} />
          )}
        </form.AppField>
        <form.AppField
          name="discountPercent"
          validators={{
            onSubmit: ({ value }) =>
              value >= 0 && value <= 100 ? null : "Rabatt må være mellom 0 og 100 %",
          }}
        >
          {(field) => (
            <field.NumberField
              label="Rabatt"
              required
              hideControls
              allowNegative={false}
              decimalScale={1}
              suffix=" %"
            />
          )}
        </form.AppField>
        <form.AppField
          name="publisher"
          validators={{ onSubmit: ({ value }) => requiredText(value, "Forlag") }}
        >
          {(field) => (
            <field.AutocompleteField label="Forlag" required data={suggestions.publishers} />
          )}
        </form.AppField>
      </SimpleGrid>
      <Group gap="xl">
        <form.AppField name="active">
          {(field) => <field.SwitchField label="Aktiv" />}
        </form.AppField>
        <form.AppField name="buyback">
          {(field) => <field.SwitchField label="Kjøpes inn" />}
        </form.AppField>
      </Group>
      {history.length > 0 && (
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Prishistorikk
          </Text>
          <Text size="xs" c="dimmed">
            Endrer du prisen, oppdateres raden for {new Date().getFullYear()}.
          </Text>
          <Table withRowBorders={false} verticalSpacing={2} maw={200}>
            <Table.Tbody>
              {history.map(([year, price]) => (
                <Table.Tr key={year}>
                  <Table.Td>{year}</Table.Td>
                  <Table.Td ta="right">{price} kr</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      )}
      <form.AppForm>
        <form.ErrorSummary />
      </form.AppForm>
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onClose}>
          Avbryt
        </Button>
        <Button loading={saveBook.isPending} onClick={form.handleSubmit}>
          {item === undefined ? "Legg til bok" : "Lagre"}
        </Button>
      </Group>
    </Stack>
  );
}
