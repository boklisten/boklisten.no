import { Button, Group, Stack } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import SubjectFields, {
  subjectFieldDefaultValues,
  subjectFieldsBody,
} from "@/features/branches/subjects/SubjectFields";
import { useAppForm } from "@/shared/hooks/form";
import { api } from "@/shared/utils/apiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export function BranchSubjectModal({ branchId, modalId }: { branchId: string; modalId: string }) {
  const queryClient = useQueryClient();
  const createMutation = useMutation(
    api.branchSubjects.store.mutationOptions({
      onSuccess: () => {
        showSuccessNotification("Faget ble opprettet!");
        modals.close(modalId);
      },
      onError: (error: unknown) =>
        showErrorNotification(errorMessage(error, "Klarte ikke opprette faget")),
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.branchSubjects.index.pathKey(),
        }),
    }),
  );

  const form = useAppForm({
    defaultValues: subjectFieldDefaultValues,
    onSubmit: ({ value }) =>
      createMutation.mutate({ params: { branchId }, body: subjectFieldsBody(value) }),
  });

  return (
    <Stack>
      <SubjectFields
        form={form}
        fields={{ name: "name", externalName: "externalName", books: "books" }}
      />
      <Group justify="right" mt="md">
        <Button variant="outline" onClick={() => modals.close(modalId)}>
          Avbryt
        </Button>
        <Button bg="green" onClick={form.handleSubmit} loading={createMutation.isPending}>
          Opprett
        </Button>
      </Group>
    </Stack>
  );
}
