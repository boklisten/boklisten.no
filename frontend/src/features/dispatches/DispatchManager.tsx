import { CSVImporter } from "@importcsv/react";
import type { Column, ImportResult } from "@importcsv/react";
import { Button, Group, Input, Paper, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconMailFast, IconSend, IconUsersPlus } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import EmailTemplateDropdown from "@/features/dispatches/EmailTemplateDropdown";
import { useAppForm } from "@/shared/hooks/form";
import { api } from "@/shared/utils/apiClient";
import { cellToString, normalizeNorwegianPhone } from "@/shared/utils/csvNormalizers";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

interface Recipient {
  phone?: string;
  email?: string;
  smsText?: string;
  emailTemplateId?: string;
}

const defaultValues: { name: string; recipients: Recipient[] } = {
  name: "",
  recipients: [],
};

const RECIPIENT_COLUMNS: Column[] = [
  {
    id: "phone",
    label: "Mobilnummer",
    description: "8 siffer uten +47, f.eks. 41234567. Trengs for SMS",
    validators: [{ type: "regex", pattern: "^[49]\\d{7}$", message: "Må være 8 siffer uten +47" }],
    transformations: [{ type: "custom", fn: normalizeNorwegianPhone, stage: "pre" }],
  },
  {
    id: "smsText",
    label: "SMS-tekst",
    description: "Meldingen som sendes til mobilnummeret på raden",
    validators: [
      { type: "min_length", value: 3, message: "Må være minst 3 tegn" },
      { type: "max_length", value: 1600, message: "Kan være maks 1600 tegn" },
    ],
    transformations: [{ type: "trim" }],
  },
  {
    id: "email",
    label: "E-post",
    description: "F.eks. kari@eksempel.no. Trengs for e-post",
    type: "email",
    transformations: [{ type: "trim" }, { type: "lowercase" }],
  },
  {
    id: "emailTemplateId",
    label: "E-postmal-ID",
    description: "ID fra listen over e-postmaler. Malen sendes til e-posten på raden",
    transformations: [{ type: "trim" }],
  },
];

function cell(row: Record<string, unknown>, key: string): string | undefined {
  return cellToString(row[key]).trim() || undefined;
}

function toRecipients(result: ImportResult): Recipient[] {
  return result.rows
    .map((row) => ({
      phone: cell(row, "phone"),
      smsText: cell(row, "smsText"),
      email: cell(row, "email"),
      emailTemplateId: cell(row, "emailTemplateId"),
    }))
    .filter((recipient) => Object.values(recipient).some((value) => value !== undefined));
}

function receivesSms(recipient: Recipient) {
  return recipient.phone !== undefined && recipient.smsText !== undefined;
}

function receivesEmail(recipient: Recipient) {
  return recipient.email !== undefined && recipient.emailTemplateId !== undefined;
}

function recipientCount(count: number) {
  return `${count} ${count === 1 ? "mottaker" : "mottakere"}`;
}

function RecipientsSummary({ recipients }: { recipients: Recipient[] }) {
  const smsCount = recipients.filter(receivesSms).length;
  const emailCount = recipients.filter(receivesEmail).length;
  const silentCount = recipients.filter(
    (recipient) => !receivesSms(recipient) && !receivesEmail(recipient),
  ).length;

  return (
    <Stack gap={2}>
      <Text fw={500}>{`${recipientCount(recipients.length)} lastet opp`}</Text>
      <Text size="sm" c="dimmed">
        {`${smsCount} får SMS og ${emailCount} får e-post.`}
      </Text>
      {silentCount > 0 && (
        <Text size="sm" c="orange.8">
          {`${silentCount} får ingen melding fordi raden mangler SMS-tekst eller e-postmal.`}
        </Text>
      )}
    </Stack>
  );
}

export default function DispatchManager() {
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [importerOpen, setImporterOpen] = useState(false);

  const sendMutation = useMutation(
    api.dispatch.store.mutationOptions({
      onSuccess: () => {
        setServerErrors([]);
        showSuccessNotification({
          icon: <IconMailFast />,
          title: "Utsendelsen var vellykket!",
          message: `Følg med på leveringsstatus i meldingsloggen under Kommunikasjon`,
        });
      },
      onError: (error) => {
        if (error.isValidationError()) {
          setServerErrors(error.response.errors.map((issue) => issue.message));
          return;
        }
        showErrorNotification("Noe gikk galt under utsendingen!");
      },
    }),
  );

  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) =>
      sendMutation.mutate({
        body: {
          name: value.name.trim() || undefined,
          recipients: value.recipients,
        },
      }),
  });

  return (
    <>
      <EmailTemplateDropdown />
      <form.AppField name="name">
        {(field) => (
          <field.TextField
            label="Navn på utsendelsen"
            description="Valgfritt. Vises i meldingsloggen under Kommunikasjon."
            placeholder="F.eks. Informasjon om høstens utdeling"
            maxLength={255}
          />
        )}
      </form.AppField>
      <form.AppField name="recipients">
        {(field) => (
          <Input.Wrapper
            label="Mottakere"
            description="Last opp en liste (CSV eller Excel) med én rad per mottaker. Rader med mobilnummer og SMS-tekst får SMS, rader med e-post og e-postmal-ID får e-post."
            error={field.state.meta.errors.join(", ")}
          >
            {field.state.value.length === 0 ? (
              <Group mt={5}>
                <Button
                  variant="default"
                  leftSection={<IconUsersPlus size={18} />}
                  onClick={() => setImporterOpen(true)}
                >
                  Last opp mottakerliste
                </Button>
              </Group>
            ) : (
              <Paper withBorder p="sm" mt={5}>
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <RecipientsSummary recipients={field.state.value} />
                  <Group gap="xs">
                    <Button variant="default" size="xs" onClick={() => setImporterOpen(true)}>
                      Bytt liste
                    </Button>
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      onClick={() => field.handleChange([])}
                    >
                      Fjern
                    </Button>
                  </Group>
                </Group>
              </Paper>
            )}
            <CSVImporter
              columns={RECIPIENT_COLUMNS}
              isModal
              modalIsOpen={importerOpen}
              modalOnCloseTriggered={() => setImporterOpen(false)}
              primaryColor="#26768f"
              onComplete={(result) => {
                setImporterOpen(false);
                const recipients = toRecipients(result);
                if (recipients.length === 0) {
                  showErrorNotification("Filen inneholder ingen mottakere!");
                  return;
                }
                setServerErrors([]);
                field.handleChange(recipients);
              }}
            />
          </Input.Wrapper>
        )}
      </form.AppField>
      <form.AppForm>
        <form.ErrorSummary serverErrors={serverErrors} />
      </form.AppForm>
      <form.Subscribe selector={(state) => state.values.recipients}>
        {(recipients) => (
          <Button
            loading={sendMutation.isPending}
            leftSection={<IconSend />}
            disabled={recipients.length === 0}
            onClick={() =>
              modals.openConfirmModal({
                title: "Bekreft utsendelse",
                children: `Du er nå i ferd med å sende en utsendelse til ${recipientCount(recipients.length)}. Dette kan ikke angres.`,
                labels: {
                  cancel: "Avbryt",
                  confirm: "Bekreft",
                },
                onConfirm: form.handleSubmit,
              })
            }
          >
            Send
          </Button>
        )}
      </form.Subscribe>
    </>
  );
}
