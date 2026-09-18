import type { Invoice } from "@boklisten/backend/shared/invoice";
import { Button, Collapse, Group, Paper, Stack, Text, TextInput } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/**
 * Danger zone at the foot of the invoice drawer, shown only for unpaid invoices. The admin
 * confirms by typing the invoice number, inline rather than in a modal, so the drawer stays put
 * and the number to copy is right above the field.
 */
export default function InvoiceDeleteSection({
  invoice,
  onDeleted,
}: {
  invoice: Invoice;
  onDeleted: () => void;
}) {
  const { client } = useApiClient();
  const [expanded, setExpanded] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmPhrase = String(invoice.invoiceId);

  const deleteMutation = useMutation({
    mutationFn: () => client.api.invoices.destroy({ params: { invoiceId: invoice.id } }),
    onSuccess: () => {
      showSuccessNotification(`Faktura ${confirmPhrase} ble slettet`);
      onDeleted();
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke slette fakturaen")),
  });

  const collapse = () => {
    setExpanded(false);
    setConfirmText("");
  };

  return (
    <Paper withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-red-6)" }}>
      <Stack gap="xs">
        <Text fw={700} c="red">
          Faresone
        </Text>
        <Text size="sm">Sletter fakturaen permanent. Bare ubetalte fakturaer kan slettes.</Text>
        {!expanded && (
          <Button
            color="red"
            variant="outline"
            leftSection={<IconTrash size={16} />}
            w="fit-content"
            onClick={() => setExpanded(true)}
          >
            Slett faktura
          </Button>
        )}
        <Collapse expanded={expanded}>
          <Stack gap="xs">
            <TextInput
              label={`Skriv «${confirmPhrase}» for å bekrefte slettingen`}
              value={confirmText}
              onChange={(event) => setConfirmText(event.currentTarget.value)}
              inputMode="numeric"
            />
            <Group gap="xs">
              <Button variant="default" onClick={collapse}>
                Avbryt
              </Button>
              <Button
                color="red"
                leftSection={<IconTrash size={16} />}
                disabled={confirmText.trim() !== confirmPhrase}
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                Slett fakturaen permanent
              </Button>
            </Group>
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
  );
}
