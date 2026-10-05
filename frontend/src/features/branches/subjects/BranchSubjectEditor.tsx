import { Button, Divider, Group, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import SubjectFields, { subjectFieldsBody } from "@/features/branches/subjects/SubjectFields";
import { bookToFormValue } from "@/features/branches/subjects/subjectOptions";
import type { BranchSubject } from "@/features/branches/subjects/subjectOptions";
import { useAppForm } from "@/shared/hooks/form";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { api, apiClient } from "@/shared/utils/apiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/** The expanded subject, auto-saved (see `useAutoSave`). */
export default function BranchSubjectEditor({
  branchId,
  subject,
}: {
  branchId: string;
  subject: BranchSubject;
}) {
  const queryClient = useQueryClient();
  const params = { branchId, subjectId: String(subject.id) };
  const invalidateSubjects = () =>
    queryClient.invalidateQueries({
      queryKey: api.branchSubjects.index.pathKey(),
    });

  const deleteMutation = useMutation(
    api.branchSubjects.destroy.mutationOptions({
      onSuccess: () => showSuccessNotification("Faget ble slettet!"),
      onError: () => showErrorNotification("Klarte ikke slette faget"),
      onSettled: invalidateSubjects,
    }),
  );

  const form = useAppForm(
    useAutoSave({
      defaultValues: {
        name: subject.name,
        externalName: subject.externalName ?? "",
        books: subject.books.map(bookToFormValue),
      },
      persist: (values) =>
        apiClient.api.branchSubjects.update({ params, body: subjectFieldsBody(values) }),
      invalidates: [api.branchSubjects.index.pathKey()],
    }),
  );

  function confirmDelete() {
    modals.openConfirmModal({
      title: "Slett fag",
      children: (
        <Text size="sm">
          Er du sikker på at du vil slette faget «{subject.name}»? Dette påvirker ikke bøkene i
          Bøker-fanen.
        </Text>
      ),
      labels: { confirm: "Slett", cancel: "Avbryt" },
      confirmProps: { color: "red" },
      onConfirm: () => deleteMutation.mutate({ params }),
    });
  }

  return (
    <Stack>
      <SubjectFields
        form={form}
        fields={{ name: "name", externalName: "externalName", books: "books" }}
      />
      <Divider />
      <Group>
        <Button
          size="xs"
          variant="light"
          color="red"
          leftSection={<IconTrash size={14} />}
          loading={deleteMutation.isPending}
          onClick={confirmDelete}
        >
          Slett fag
        </Button>
      </Group>
    </Stack>
  );
}
