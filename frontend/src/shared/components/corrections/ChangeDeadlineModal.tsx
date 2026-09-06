import { Button, Group, Modal, Stack } from "@mantine/core";

import MonitoringNotice from "@/shared/components/MonitoringNotice";
import { useAppForm } from "@/shared/hooks/form";
import { norwegianTime } from "@/shared/utils/dayjs";

/**
 * An employee's correction of a book's deadline. The change is monitored, so the modal says so
 * before the form. The caller owns the write; this only collects the date, as a UTC-midnight ISO
 * timestamp the way deadlines are stored.
 */
export default function ChangeDeadlineModal({
  currentDeadline,
  description,
  isPending,
  onClose,
  onSubmit,
}: {
  currentDeadline: string | Date;
  /** What the deadline means for this thing, shown under the picker label. */
  description: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (deadline: string) => void;
}) {
  const current = norwegianTime(currentDeadline).format("YYYY-MM-DD");
  const form = useAppForm({
    defaultValues: { deadline: current },
    onSubmit: ({ value }) => {
      if (value.deadline !== null) {
        onSubmit(new Date(`${value.deadline}T00:00:00.000Z`).toISOString());
      }
    },
  });
  return (
    <Modal opened onClose={onClose} title="Endre frist">
      <Stack>
        <MonitoringNotice>Administrator får beskjed hvis du endrer fristen.</MonitoringNotice>
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
                disabled={deadline === null || deadline === current}
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
