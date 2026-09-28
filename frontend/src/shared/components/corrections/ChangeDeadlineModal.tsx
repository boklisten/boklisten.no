import { Button, Group, Modal, Stack } from "@mantine/core";

import MonitoringNotice from "@/shared/components/MonitoringNotice";
import { useAppForm } from "@/shared/hooks/form";

/**
 * An employee's correction of a book's deadline. The change is monitored, so the modal says so
 * before the form. The caller owns the write; this only collects the day, `YYYY-MM-DD`.
 */
export default function ChangeDeadlineModal({
  currentDeadline,
  description,
  isPending,
  onClose,
  onSubmit,
}: {
  /** `YYYY-MM-DD`. */
  currentDeadline: string;
  /** What the deadline means for this thing, shown under the picker label. */
  description: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (deadline: string) => void;
}) {
  const form = useAppForm({
    defaultValues: { deadline: currentDeadline },
    onSubmit: ({ value }) => {
      if (value.deadline !== null) {
        onSubmit(value.deadline);
      }
    },
  });
  return (
    <Modal opened onClose={onClose} title="Endre frist">
      <Stack>
        <MonitoringNotice />
        <form.AppField name="deadline">
          {(field) => <field.DeadlinePickerField clearable={false} description={description} />}
        </form.AppField>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Avbryt
          </Button>
          <form.Subscribe selector={(state) => state.values.deadline}>
            {(deadline) => (
              <Button
                loading={isPending}
                disabled={deadline === null || deadline === currentDeadline}
                onClick={form.handleSubmit}
              >
                Endre frist
              </Button>
            )}
          </form.Subscribe>
        </Group>
      </Stack>
    </Modal>
  );
}
