import { Button } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconMailFast, IconSend } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import EmailTemplateDropdown from "@/features/dispatches/EmailTemplateDropdown";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import { Route } from "@tuyau/core/types";

const defaultValues: {
  name: string;
  recipients: {
    email?: string;
    phone?: string;
    sms_text?: string;
    email_template_id?: string;
  }[];
} = {
  name: "",
  recipients: [],
};

export default function DispatchManager() {
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const { client } = useApiClient();

  const sendMutation = useMutation({
    mutationFn: async (formData: Route.Request<"dispatch.create_dispatch">) => {
      setServerErrors([]);
      const [, error] = await client.api.dispatch.createDispatch(formData).safe();

      if (error) {
        if (error.isValidationError()) {
          setServerErrors(error.response.errors.map((err) => err.message));
          return;
        }
        showErrorNotification("Noe gikk galt under utsendingen!");
        return;
      }

      showSuccessNotification({
        icon: <IconMailFast />,
        title: "Utsendelsen var vellykket!",
        message: `Følg med på leveringsstatus i meldingsloggen under Kommunikasjon`,
      });
    },
  });

  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) =>
      sendMutation.mutate({
        body: {
          name: value.name.trim() || undefined,
          recipients: value.recipients.map((recipient) => ({
            phone: recipient.phone,
            email: recipient.email,
            smsText: recipient.sms_text,
            emailTemplateId: recipient.email_template_id,
          })),
        },
      }),
  });
  return (
    <>
      <EmailTemplateDropdown />
      <form.AppField name={"name"}>
        {(field) => (
          <field.TextField
            label={"Navn på utsendelsen"}
            description={"Valgfritt. Vises i meldingsloggen under Kommunikasjon."}
            placeholder={"F.eks. Informasjon om høstens utdeling"}
            maxLength={255}
          />
        )}
      </form.AppField>
      <form.AppField name={"recipients"}>
        {(field) => (
          <field.CsvFileField
            label={"Mottakere"}
            headers={[
              { label: "phone" },
              { label: "email" },
              { label: "sms_text" },
              { label: "email_template_id" },
            ]}
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.ErrorSummary serverErrors={serverErrors} />
      </form.AppForm>
      <form.Subscribe selector={(state) => state.values.recipients}>
        {(field) => (
          <Button
            loading={sendMutation.isPending}
            leftSection={<IconSend />}
            disabled={!field || field.length === 0}
            onClick={() =>
              modals.openConfirmModal({
                title: "Bekreft utsendelse",
                children: `Du er nå i ferd med å sende en utsendelse til ${field?.length} ${field?.length > 1 ? "mottakere" : "mottaker"}. Dette kan ikke angres.`,
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
