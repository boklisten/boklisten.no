import { Button, Divider, Group, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import SubjectFields, { subjectFieldsBody } from "@/features/branches/subjects/SubjectFields";
import type { SubjectFieldValues } from "@/features/branches/subjects/SubjectFields";
import { bookToFormValue } from "@/features/branches/subjects/subjectOptions";
import type { BranchSubject } from "@/features/branches/subjects/subjectOptions";
import { useAppForm } from "@/shared/hooks/form";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { api } from "@/shared/utils/apiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/**
 * The expanded subject: `subject` must stay the one it was opened with, so the refetch after each
 * save cannot reset what the user is editing. Every change is saved right away, the names on blur
 * and the books on change (see `useAutoSave`).
 */
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

  const updateMutation = useMutation(api.branchSubjects.update.mutationOptions());
  const deleteMutation = useMutation(
    api.branchSubjects.destroy.mutationOptions({
      onSuccess: () => showSuccessNotification("Faget ble slettet!"),
      onError: () => showErrorNotification("Klarte ikke slette faget"),
      onSettled: invalidateSubjects,
    }),
  );

  const defaultValues: SubjectFieldValues = {
    name: subject.name,
    externalName: subject.externalName ?? "",
    books: subject.books.map(bookToFormValue),
  };
  const autoSave = useAutoSave({
    initialBody: subjectFieldsBody(defaultValues),
    persist: (body) => updateMutation.mutateAsync({ params, body }),
    notifications: {
      id: `branch-subject-saved-${subject.id}`,
      saved: "Faget ble lagret!",
      failed: "Klarte ikke lagre faget",
    },
    onSaved: () => void invalidateSubjects(),
  });

  function save(values: SubjectFieldValues) {
    if (values.name.trim().length === 0) {
      return;
    }
    autoSave.save(subjectFieldsBody(values));
  }

  const form = useAppForm({
    defaultValues,
    listeners: {
      onBlur: ({ fieldApi, formApi }) => {
        if (fieldApi.name === "name" || fieldApi.name === "externalName") {
          save(formApi.state.values);
        }
      },
      onChange: ({ fieldApi, formApi }) => {
        if (fieldApi.name.startsWith("books")) {
          save(formApi.state.values);
        }
      },
    },
  });

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
