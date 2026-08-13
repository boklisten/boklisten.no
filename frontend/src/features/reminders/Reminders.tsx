import type { CustomerItemType } from "@boklisten/backend/shared/customer-item/customer-item-type";
import { MessageMethod } from "@boklisten/backend/shared/message/message-method/message-method";
import { Button, Grid, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconMailFast, IconSend } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Activity } from "react";

import { calculateSmsSegmentFeedback } from "@/features/reminders/sms";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import {
  showErrorNotification,
  showInfoNotification,
  showSuccessNotification,
} from "@/shared/utils/notifications";

interface RemindersFormData {
  branchIds: string[];
  deadline: string | null;
  customerItemType: CustomerItemType;
  messageMethod: MessageMethod;
  emailTemplateId: string | null;
  smsText: string | null;
}

const defaultValues: RemindersFormData = {
  branchIds: [],
  deadline: null,
  customerItemType: "rent",
  messageMethod: MessageMethod.SMS,
  emailTemplateId: "",
  smsText: "",
};

export default function Reminders() {
  const { api } = useApiClient();

  const countRecipientsMutation = useMutation(
    api.reminders.countRecipients.mutationOptions({
      onError: () => showErrorNotification("Klarte ikke beregne antall mottakere"),
    }),
  );

  const sendReminderMutation = useMutation(
    api.reminders.remind.mutationOptions({
      onError: () => showErrorNotification("Klarte ikke sende påminnelse"),
      onSuccess: () =>
        showSuccessNotification({
          icon: <IconMailFast />,
          title: "Påminnelse ble sendt!",
          message: `Husk å sjekke status hos Twilio / SendGrid for å bekrefte at påminnelsen har kommet frem`,
        }),
    }),
  );

  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const formData = form.state.values;
      const payload = {
        deadlineISO: dayjs(formData.deadline).toISOString(),
        customerItemType: formData.customerItemType,
        branchIDs: formData.branchIds,
        emailTemplateId: formData.emailTemplateId,
        smsText: formData.smsText,
      };
      const { recipientCount } = await countRecipientsMutation.mutateAsync({
        body: payload,
      });
      if (recipientCount === 0) {
        showInfoNotification("Fant ingen kunder med valgte innstillinger");
        return;
      }
      modals.openConfirmModal({
        title: "Bekreft utsending av påminnelse",
        children: (
          <Text size="sm">
            Du er nå i ferd med å sende en påminnelse på{" "}
            {value.messageMethod === "sms" ? "sms" : "e-post"} til {recipientCount} kunder.
          </Text>
        ),
        labels: { confirm: "Send", cancel: "Avbryt" },
        confirmProps: { leftSection: <IconSend /> },
        onConfirm: () =>
          sendReminderMutation.mutate({
            body: payload,
          }),
      });
    },
  });

  return (
    <>
      <form.AppField
        name={"branchIds"}
        validators={{
          onChange: ({ value }) => (value.length === 0 ? "Du må velge minst en filial" : null),
        }}
      >
        {(field) => <field.SelectBranchesField />}
      </form.AppField>
      <form.AppField
        name={"deadline"}
        validators={{
          onSubmit: ({ value }) => {
            if (!value) return "Du må velge en frist";
            return null;
          },
        }}
      >
        {(field) => <field.DeadlinePickerField />}
      </form.AppField>
      <Grid>
        <Grid.Col span={{ base: 12, xs: 6 }}>
          <form.AppField name={"customerItemType"}>
            {(field) => (
              <field.SegmentedControlField
                label={"Kundetype"}
                data={[
                  { value: "rent", label: "VGS" },
                  { value: "partly-payment", label: "Privatist" },
                ]}
              />
            )}
          </form.AppField>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xs: 6 }}>
          <form.AppField name={"messageMethod"}>
            {(field) => (
              <field.SegmentedControlField
                label={"Meldingstype"}
                data={[
                  { value: MessageMethod.SMS, label: "SMS" },
                  { value: MessageMethod.EMAIL, label: "E-post" },
                ]}
              />
            )}
          </form.AppField>
        </Grid.Col>
      </Grid>
      <form.Subscribe selector={(state) => state.values.messageMethod}>
        {(messageMethod) => (
          <>
            <Activity mode={messageMethod === MessageMethod.SMS ? "visible" : "hidden"}>
              <form.AppField
                name={"smsText"}
                validators={{
                  onChangeListenTo: ["messageMethod"],
                  onChange: ({ value }) =>
                    form.state.values.messageMethod === "sms" && (!value || value.length === 0)
                      ? "Du må fylle inn melding"
                      : null,
                }}
              >
                {(field) => (
                  <field.TextAreaField
                    label={"Melding"}
                    description={calculateSmsSegmentFeedback(field.state.value ?? "")}
                    placeholder={"Hei! [...] Mvh, Boklisten.no"}
                    autosize
                    minRows={2}
                    maxRows={10}
                  />
                )}
              </form.AppField>
            </Activity>

            <Activity mode={messageMethod === MessageMethod.EMAIL ? "visible" : "hidden"}>
              <form.AppField
                name={"emailTemplateId"}
                validators={{
                  onChangeListenTo: ["messageMethod"],
                  onChange: ({ value }) => {
                    if (form.state.values.messageMethod === "email" && !value)
                      return "Du må velge e-postmal";

                    return null;
                  },
                }}
              >
                {(field) => <field.SelectEmailTemplateField />}
              </form.AppField>
            </Activity>
          </>
        )}
      </form.Subscribe>
      <form.AppForm>
        <form.ErrorSummary />
      </form.AppForm>
      <Button
        leftSection={<IconSend />}
        onClick={form.handleSubmit}
        loading={countRecipientsMutation.isPending || sendReminderMutation.isPending}
      >
        Send
      </Button>
    </>
  );
}
