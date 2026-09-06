import type { CompanyInvoiceLine } from "@boklisten/backend/shared/invoice";
import { companyLinePayment } from "@boklisten/backend/shared/invoice";
import type { Item } from "@boklisten/backend/shared/item";
import { Autocomplete, Button, Group, NumberInput, SimpleGrid, Stack, Text } from "@mantine/core";
import { useState } from "react";

import { formatKroner } from "@/features/invoices/invoiceLabels";

export const EMPTY_LINE: CompanyInvoiceLine = {
  title: "",
  productNumber: 1,
  price: 0,
  numberOfUnits: 1,
  discount: 0,
  taxPercentage: 0,
};

/**
 * One line on a company invoice. Typing a title offers the books we sell; picking one fills in
 * its price, and every field stays editable since schools get their own prices and discounts.
 */
export default function CompanyInvoiceLineModal({
  line = EMPTY_LINE,
  items,
  onSave,
  onClose,
}: {
  line?: CompanyInvoiceLine;
  items: Item[];
  onSave: (line: CompanyInvoiceLine) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CompanyInvoiceLine>(line);
  // Picking a book fires onOptionSubmit and then onChange; both must build on the latest draft.
  const update = (patch: Partial<CompanyInvoiceLine>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const titles = [...new Set(items.map((item) => item.title))];
  const valid = draft.title.trim().length > 0 && draft.numberOfUnits > 0 && draft.price >= 0;

  return (
    <Stack>
      <Autocomplete
        label="Tittel"
        placeholder="Skriv for å finne en bok"
        data={titles}
        value={draft.title}
        onChange={(title) => update({ title })}
        onOptionSubmit={(title) => {
          const item = items.find((candidate) => candidate.title === title);
          update({ title, ...(item ? { price: item.price } : {}) });
        }}
        limit={8}
        data-autofocus
      />
      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
        <NumberInput
          label="Pris uten mva"
          suffix=" kr"
          value={draft.price}
          onChange={(value) => update({ price: Number(value) })}
          hideControls
          min={0}
          decimalScale={2}
        />
        <NumberInput
          label="Antall"
          value={draft.numberOfUnits}
          onChange={(value) => update({ numberOfUnits: Number(value) })}
          min={1}
          allowDecimal={false}
        />
        <NumberInput
          label="Rabatt"
          suffix=" %"
          value={draft.discount}
          onChange={(value) => update({ discount: Number(value) })}
          hideControls
          min={0}
          max={100}
        />
        <NumberInput
          label="Mva"
          suffix=" %"
          value={draft.taxPercentage}
          onChange={(value) => update({ taxPercentage: Number(value) })}
          hideControls
          min={0}
          max={100}
        />
        <NumberInput
          label="Produktnummer"
          value={draft.productNumber}
          onChange={(value) => update({ productNumber: Number(value) })}
          hideControls
          min={0}
          allowDecimal={false}
        />
      </SimpleGrid>
      <Group justify="space-between" align="center">
        <Text size="sm">
          Linjen kommer til{" "}
          <Text span fw={600}>
            {formatKroner(companyLinePayment(draft).gross)}
          </Text>
        </Text>
        <Group>
          <Button variant="default" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onSave({ ...draft, title: draft.title.trim() });
              onClose();
            }}
          >
            {line === EMPTY_LINE ? "Legg til linje" : "Lagre linje"}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
