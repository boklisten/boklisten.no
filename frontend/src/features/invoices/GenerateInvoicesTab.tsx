import type {
  GeneratableInvoiceType,
  InvoiceGenerationDefaults,
  InvoiceGenerationResult,
  InvoiceListRow,
} from "@boklisten/backend/shared/invoice";
import {
  Button,
  Fieldset,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconDeviceFloppy, IconEye } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";

import InvoiceGrid from "@/features/invoices/InvoiceGrid";
import { INVOICE_TYPE_LABELS, formatKroner } from "@/features/invoices/invoiceLabels";
import SegmentedControlWithLabel from "@/shared/components/SegmentedControlWithLabel";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import asyncConfirmModal from "@/shared/utils/asyncConfirmModal";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const route = getRouteApi("/(administrasjon)/admin/faktura");

type DateRange = [Date | null, Date | null];

/**
 * Deadlines fall at the end of each semester, so the natural windows are the spring and autumn
 * halves of the last few years.
 */
function semesterPresets(): { value: [string, string]; label: string }[] {
  const now = dayjs();
  const presets: { value: [string, string]; label: string }[] = [];
  for (let year = now.year(); year >= now.year() - 2; year--) {
    presets.push(
      {
        value: [`${year}-08-01`, `${year}-12-31`],
        label: `Høst ${year}`,
      },
      {
        value: [`${year}-01-01`, `${year}-07-31`],
        label: `Vår ${year}`,
      },
    );
  }
  return presets.filter((preset) => dayjs(preset.value[0]).isBefore(now));
}

/** The last semester whose deadlines have passed: the books still out from it are what gets invoiced. */
function defaultRange(): DateRange {
  const now = dayjs();
  return now.month() < 7
    ? [
        now.subtract(1, "year").month(7).startOf("month").toDate(),
        now.subtract(1, "year").endOf("year").toDate(),
      ]
    : [now.startOf("year").toDate(), now.month(6).endOf("month").toDate()];
}

/** Settings as edited, in percent where an employee thinks in percent. */
interface Settings {
  /** Typed by the employee; the convention is YYYY, a batch digit and a running number. */
  invoiceNumber: number | null;
  fee: number;
  feeVatPercent: number;
  pricePercent: number;
  daysToDeadline: number;
  reference: string;
}

function settingsFromDefaults(defaults: InvoiceGenerationDefaults): Settings {
  return {
    invoiceNumber: null,
    fee: defaults.fee,
    feeVatPercent: Math.round(defaults.feeVatPercentage * 100),
    pricePercent: Math.round(defaults.feePercentage * 100),
    daysToDeadline: defaults.daysToDeadline,
    reference: defaults.reference,
  };
}

function previewRows(result: InvoiceGenerationResult): InvoiceListRow[] {
  return result.invoices.map((invoice) => ({
    id: invoice.invoiceId ?? "",
    invoiceId: invoice.invoiceId ?? "",
    customerName: invoice.customerInfo.name,
    organizationNumber: null,
    type: invoice.type ?? null,
    duedate: invoice.duedate,
    totalIncludingFee: invoice.payment.totalIncludingFee,
    status: "unpaid",
  }));
}

export default function GenerateInvoicesTab() {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const navigate = route.useNavigate();
  const [type, setType] = useState<GeneratableInvoiceType>("partly-payment");
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [edited, setEdited] = useState<Partial<Record<GeneratableInvoiceType, Settings>>>({});
  const [preview, setPreview] = useState<InvoiceGenerationResult | null>(null);

  const defaults = useQuery(api.invoices.generationDefaults.queryOptions({ query: { type } }));
  const settings =
    edited[type] ?? (defaults.data === undefined ? undefined : settingsFromDefaults(defaults.data));
  const update = (patch: Partial<Settings>) =>
    settings && setEdited({ ...edited, [type]: { ...settings, ...patch } });

  const payload = (dryRun: boolean) => {
    const [from, to] = range;
    if (!settings || settings.invoiceNumber === null || !from || !to) {
      return null;
    }
    return {
      type,
      deadlineFrom: dayjs(from).startOf("day").toISOString(),
      deadlineTo: dayjs(to).endOf("day").toISOString(),
      invoiceNumber: settings.invoiceNumber,
      fee: settings.fee,
      feeVatPercentage: settings.feeVatPercent / 100,
      feePercentage: settings.pricePercent / 100,
      daysToDeadline: settings.daysToDeadline,
      reference: settings.reference,
      dryRun,
    };
  };

  const generate = useMutation({
    mutationFn: (dryRun: boolean) => {
      const body = payload(dryRun);
      if (!body) {
        throw new Error("Velg periode først");
      }
      return client.api.invoices.generate({ body });
    },
    onSuccess: (result, dryRun) => {
      if (dryRun) {
        setPreview(result);
        return;
      }
      showSuccessNotification(`${result.invoices.length} fakturaer ble lagret`);
      void queryClient.invalidateQueries({ queryKey: api.invoices.batches.pathKey() });
      void queryClient.invalidateQueries({ queryKey: api.invoices.list.pathKey() });
      setPreview(null);
      void navigate({
        search: {
          fakturaFane: undefined,
          fakturarunde: settings?.invoiceNumber
            ? String(settings.invoiceNumber).slice(0, 5)
            : undefined,
        },
      });
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke lage fakturaer")),
  });

  async function save() {
    if (!preview) {
      return;
    }
    const confirmed = await asyncConfirmModal({
      title: `Lagre ${preview.invoices.length} fakturaer?`,
      children:
        "Fakturaene får numrene fra forhåndsvisningen og dukker opp i oversikten. Der kan de eksporteres.",
      confirmLabel: "Lagre fakturaene",
    });
    if (confirmed) {
      generate.mutate(false);
    }
  }

  const ready = payload(true) !== null;
  const previewTotal = preview?.invoices.reduce(
    (sum, invoice) => sum + invoice.payment.totalIncludingFee,
    0,
  );

  return (
    <Stack gap="lg">
      <Text c="dimmed" maw={640}>
        Lager én faktura per elev for bøker som verken er levert eller kjøpt ut innen fristen.
      </Text>
      <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
        <Fieldset legend="Bøker som skal faktureres">
          <Stack>
            <SegmentedControlWithLabel
              label="Type"
              value={type}
              onChange={(value) => {
                setType(value === "rent" ? "rent" : "partly-payment");
                setPreview(null);
              }}
              data={(["partly-payment", "rent"] as const).map((option) => ({
                value: option,
                label: INVOICE_TYPE_LABELS[option],
              }))}
            />
            <DatePickerInput
              type="range"
              label="Frist mellom"
              description="Bøker med frist i denne perioden faktureres"
              valueFormat="DD.MM.YYYY"
              value={range}
              onChange={(next) => {
                setRange([next[0] ? new Date(next[0]) : null, next[1] ? new Date(next[1]) : null]);
                setPreview(null);
              }}
              presets={semesterPresets()}
              allowSingleDateInRange
            />
          </Stack>
        </Fieldset>

        <Fieldset legend="Beløp">
          <Stack>
            {type === "rent" && (
              <NumberInput
                label="Andel av bokpris"
                description="110 % betyr bokas pris pluss 10 % påslag"
                suffix=" %"
                value={settings?.pricePercent ?? ""}
                onChange={(value) => update({ pricePercent: Number(value) })}
                hideControls
                min={0}
                disabled={!settings}
              />
            )}
            {type === "partly-payment" && (
              <Text size="sm" c="dimmed">
                Hver bok faktureres for det som gjenstår å betale av utkjøpsprisen.
              </Text>
            )}
            <Group grow align="flex-start">
              <NumberInput
                label="Gebyr per bok"
                suffix=" kr"
                value={settings?.fee ?? ""}
                onChange={(value) => update({ fee: Number(value) })}
                hideControls
                min={0}
                disabled={!settings}
              />
              <NumberInput
                label="Mva på gebyret"
                suffix=" %"
                value={settings?.feeVatPercent ?? ""}
                onChange={(value) => update({ feeVatPercent: Number(value) })}
                hideControls
                min={0}
                max={100}
                disabled={!settings}
              />
            </Group>
          </Stack>
        </Fieldset>

        <Fieldset legend="Faktura">
          <Stack>
            <Group grow align="flex-start">
              <NumberInput
                label="Første fakturanummer"
                placeholder="F.eks. 20261000"
                value={settings?.invoiceNumber ?? ""}
                onChange={(value) => update({ invoiceNumber: value === "" ? null : Number(value) })}
                hideControls
                allowDecimal={false}
                disabled={!settings}
              />
              <NumberInput
                label="Dager til forfall"
                value={settings?.daysToDeadline ?? ""}
                onChange={(value) => update({ daysToDeadline: Number(value) })}
                hideControls
                allowDecimal={false}
                min={0}
                disabled={!settings}
              />
            </Group>
            <TextInput
              label="Referanse"
              value={settings?.reference ?? ""}
              onChange={(event) => update({ reference: event.currentTarget.value })}
              disabled={!settings}
            />
          </Stack>
        </Fieldset>
      </SimpleGrid>

      <Group justify="flex-end">
        <Button
          variant={preview ? "default" : "filled"}
          leftSection={<IconEye size={18} />}
          loading={generate.isPending && generate.variables}
          disabled={!ready}
          onClick={() => generate.mutate(true)}
        >
          Forhåndsvis
        </Button>
      </Group>

      {preview && (
        <Stack>
          <Group justify="space-between" align="flex-end" wrap="wrap">
            <Stack gap={2}>
              <Title order={3}>
                {preview.invoices.length === 0
                  ? "Ingen bøker å fakturere"
                  : `${preview.invoices.length} fakturaer, ${formatKroner(previewTotal ?? 0)}`}
              </Title>
              <Text size="sm" c="dimmed">
                {preview.invoices.length === 0
                  ? "Ingen bøker av denne typen har frist i perioden uten å være levert eller kjøpt ut."
                  : "Ikke lagret ennå."}
              </Text>
            </Stack>
            {preview.invoices.length > 0 && (
              <Button
                leftSection={<IconDeviceFloppy size={18} />}
                loading={generate.isPending && !generate.variables}
                onClick={() => void save()}
              >
                Lagre {preview.invoices.length} fakturaer
              </Button>
            )}
          </Group>
          {preview.skipped.length > 0 && (
            <WarningAlert title={`${preview.skipped.length} bøker ble hoppet over`}>
              {[...new Set(preview.skipped.map((skip) => skip.reason))].join(" ")}
            </WarningAlert>
          )}
          {preview.invoices.length > 0 && (
            <InvoiceGrid rows={previewRows(preview)} loading={false} height="60vh" />
          )}
        </Stack>
      )}
    </Stack>
  );
}
