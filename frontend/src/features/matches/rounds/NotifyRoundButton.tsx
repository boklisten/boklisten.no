import { Button, Group, Modal, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconSpeakerphone } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { Activity, useState } from "react";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { useAppForm } from "@/shared/hooks/form";
import { showSuccessNotification } from "@/shared/utils/notifications";

type NotifyTarget = "user-matches" | "stand-only" | "all";

interface NotifyFields {
  target: NotifyTarget;
  message: string;
}

export default function NotifyRoundButton({
  roundId,
  disabled = false,
}: {
  roundId: string | null;
  disabled?: boolean;
}) {
  const { client } = useApiClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const notifyMutation = useMutation({
    mutationFn: async (values: NotifyFields) => {
      setApiError(null);
      return client.api.matches.notify({
        body: {
          target: values.target,
          message: values.message.trim(),
          ...(roundId !== null && { roundId: Number(roundId) }),
        },
      });
    },
    onSuccess: () => {
      showSuccessNotification("Meldingen er sendt");
      close();
    },
    onError: (error: Error) => setApiError(error.message),
  });

  const defaultValues: NotifyFields = { target: "all", message: "" };
  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) => notifyMutation.mutate(value),
  });

  return (
    <>
      <Button
        variant={"default"}
        disabled={disabled}
        leftSection={<IconSpeakerphone size={16} />}
        onClick={open}
      >
        Send melding
      </Button>
      <Modal opened={opened} onClose={close} title={"Send melding til elevene i runden"}>
        <Stack>
          <Activity mode={apiError ? "visible" : "hidden"}>
            <ErrorAlert title={"Klarte ikke sende meldingen"}>{apiError}</ErrorAlert>
          </Activity>

          <form.AppField name={"target"}>
            {(field) => (
              <field.SegmentedControlField
                label={"Mottakere"}
                data={[
                  { label: "Alle", value: "all" },
                  { label: "Elevoverleveringer", value: "user-matches" },
                  { label: "Kun stand", value: "stand-only" },
                ]}
              />
            )}
          </form.AppField>

          <form.AppField
            name={"message"}
            validators={{
              onBlur: ({ value }) =>
                value.trim().length < 10 ? "Meldingen må være på minst 10 tegn" : null,
            }}
          >
            {(field) => (
              <field.TextAreaField
                required
                autosize
                minRows={4}
                label={"Melding"}
                description={"Sendes som SMS og e-post"}
              />
            )}
          </form.AppField>

          <Group justify={"flex-end"}>
            <Button variant={"default"} onClick={close}>
              Avbryt
            </Button>
            <Button loading={notifyMutation.isPending} onClick={form.handleSubmit}>
              Send
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
