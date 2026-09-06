import type { CompanyInvoiceLine } from "@boklisten/backend/shared/invoice";
import { companyLinePayment } from "@boklisten/backend/shared/invoice";
import {
  ActionIcon,
  Button,
  Fieldset,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { modals } from "@mantine/modals";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";

import CompanyInvoiceLineModal from "@/features/invoices/CompanyInvoiceLineModal";
import { formatKroner } from "@/features/invoices/invoiceLabels";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const route = getRouteApi("/(administrasjon)/admin/faktura");
const amountStyle = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

interface Draft {
  companyId: string | null;
  invoiceNumber: string;
  reference: string;
  ourReference: string;
  comment: string;
  duedate: Date;
  lines: CompanyInvoiceLine[];
}

function emptyDraft(): Draft {
  return {
    companyId: null,
    invoiceNumber: "",
    reference: "",
    ourReference: "",
    comment: "",
    duedate: dayjs().add(14, "day").toDate(),
    lines: [],
  };
}

export default function CompanyInvoiceTab() {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const navigate = route.useNavigate();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const companies = useQuery(api.companies.getCompanies.queryOptions());
  const items = useQuery(api.items.getAllForAdmin.queryOptions());

  const create = useMutation({
    mutationFn: () =>
      client.api.invoices.createCompanyInvoice({
        body: {
          companyId: draft.companyId ?? "",
          invoiceNumber: draft.invoiceNumber,
          reference: draft.reference,
          ourReference: draft.ourReference,
          duedate: draft.duedate.toISOString(),
          ...(draft.comment.trim() ? { comment: draft.comment.trim() } : {}),
          lines: draft.lines,
        },
      }),
    onSuccess: (invoice) => {
      showSuccessNotification(`Faktura ${invoice.invoiceId} ble opprettet`);
      void queryClient.invalidateQueries({ queryKey: api.invoices.batches.pathKey() });
      void queryClient.invalidateQueries({ queryKey: api.invoices.list.pathKey() });
      void navigate({
        search: {
          fakturaFane: undefined,
          fakturarunde: invoice.invoiceId ? invoice.invoiceId.slice(0, 5) : undefined,
          faktura: invoice.id,
        },
      });
    },
    onError: (error) =>
      showErrorNotification(errorMessage(error, "Klarte ikke opprette fakturaen")),
  });

  function openLineModal(index?: number) {
    const modalId = modals.open({
      title: index === undefined ? "Legg til linje" : "Endre linje",
      size: "lg",
      children: (
        <CompanyInvoiceLineModal
          line={index === undefined ? undefined : draft.lines[index]}
          items={items.data ?? []}
          onSave={(line) =>
            setDraft((current) => ({
              ...current,
              lines:
                index === undefined
                  ? [...current.lines, line]
                  : current.lines.map((existing, i) => (i === index ? line : existing)),
            }))
          }
          onClose={() => modals.close(modalId)}
        />
      ),
    });
  }

  const total = draft.lines.reduce((sum, line) => sum + companyLinePayment(line).gross, 0);
  const ready =
    draft.companyId !== null &&
    draft.invoiceNumber.trim().length > 0 &&
    draft.reference.trim().length > 0 &&
    draft.ourReference.trim().length > 0 &&
    draft.lines.length > 0;

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Fieldset legend="Mottaker">
          <Stack>
            <Select
              label="Selskap"
              placeholder={companies.isLoading ? "Laster …" : "Velg selskap"}
              data={(companies.data ?? []).map((company) => ({
                value: company.id,
                label: company.organizationNumber
                  ? `${company.name} (${company.organizationNumber})`
                  : company.name,
              }))}
              value={draft.companyId}
              onChange={(companyId) => update({ companyId })}
              searchable
              nothingFoundMessage="Ingen selskap funnet. Legg det til under Databaseverktøy."
            />
            <Group grow align="flex-start">
              <TextInput
                label="Deres referanse"
                description="Kontaktpersonen hos selskapet"
                value={draft.reference}
                onChange={(event) => update({ reference: event.currentTarget.value })}
              />
              <TextInput
                label="Vår referanse"
                description="Den hos oss som følger opp fakturaen"
                value={draft.ourReference}
                onChange={(event) => update({ ourReference: event.currentTarget.value })}
              />
            </Group>
          </Stack>
        </Fieldset>

        <Fieldset legend="Faktura">
          <Stack>
            <Group grow align="flex-start">
              <TextInput
                label="Fakturanummer"
                placeholder="F.eks. 20268001"
                value={draft.invoiceNumber}
                onChange={(event) => update({ invoiceNumber: event.currentTarget.value })}
              />
              <DateInput
                label="Forfall"
                valueFormat="DD.MM.YYYY"
                value={draft.duedate}
                onChange={(value) => value && update({ duedate: new Date(value) })}
              />
            </Group>
            <Textarea
              label="Kommentar"
              description="Skrives på fakturaen, for eksempel hvilke bestillinger den gjelder"
              value={draft.comment}
              onChange={(event) => update({ comment: event.currentTarget.value })}
              autosize
              minRows={2}
            />
          </Stack>
        </Fieldset>
      </SimpleGrid>

      <Fieldset legend="Linjer">
        <Stack>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Én linje per bok eller vare.
            </Text>
            <Button
              variant="light"
              size="compact-md"
              leftSection={<IconPlus size={16} />}
              onClick={() => openLineModal()}
              disabled={items.isLoading}
            >
              Legg til linje
            </Button>
          </Group>
          {draft.lines.length === 0 ? (
            <Text size="sm" c="dimmed">
              Ingen linjer ennå.
            </Text>
          ) : (
            <Table verticalSpacing="xs" withRowBorders={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tittel</Table.Th>
                  <Table.Th ta="right">Antall</Table.Th>
                  <Table.Th ta="right">Pris</Table.Th>
                  <Table.Th ta="right">Rabatt</Table.Th>
                  <Table.Th ta="right">Beløp</Table.Th>
                  <Table.Th w={80} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {draft.lines.map((line, index) => (
                  <Table.Tr key={`${line.title}-${index}`}>
                    <Table.Td>{line.title}</Table.Td>
                    <Table.Td ta="right" style={amountStyle}>
                      {line.numberOfUnits}
                    </Table.Td>
                    <Table.Td ta="right" style={amountStyle}>
                      {formatKroner(line.price)}
                    </Table.Td>
                    <Table.Td ta="right" style={amountStyle}>
                      {line.discount ? `${line.discount} %` : ""}
                    </Table.Td>
                    <Table.Td ta="right" style={amountStyle}>
                      {formatKroner(companyLinePayment(line).gross)}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap" justify="flex-end">
                        <Tooltip label="Endre linjen">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`Endre ${line.title}`}
                            onClick={() => openLineModal(index)}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Fjern linjen">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label={`Fjern ${line.title}`}
                            onClick={() =>
                              update({ lines: draft.lines.filter((_, i) => i !== index) })
                            }
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th colSpan={4}>Å betale</Table.Th>
                  <Table.Th ta="right" style={amountStyle}>
                    {formatKroner(total)}
                  </Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          )}
        </Stack>
      </Fieldset>

      <Group justify="flex-end">
        <Button disabled={!ready} loading={create.isPending} onClick={() => create.mutate()}>
          Opprett faktura
        </Button>
      </Group>
    </Stack>
  );
}
