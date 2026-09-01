import { Button, Group, Stack } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function MoveBranchMemberModal({
  branchId,
  memberId,
  onClose,
}: {
  branchId: string;
  memberId: string;
  onClose: () => void;
}) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();

  const updateBranchMembershipMutation = useMutation(
    api.branchMembership.updateMembership.mutationOptions({
      onSuccess: () => {
        showSuccessNotification("Medlemsskapet ble endret!");
        onClose();
      },
      onError: () => showErrorNotification("Klarte ikke endre medlemsskap!"),
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.branchMembership.getMembers.queryKey({ params: { branchId } }),
        }),
    }),
  );

  const form = useAppForm({
    defaultValues: {
      branchMembership: branchId,
    },
    onSubmit: ({ value }) =>
      updateBranchMembershipMutation.mutate({
        body: {
          detailsId: memberId,
          branchMembership: value.branchMembership,
        },
      }),
  });

  return (
    <Stack>
      <form.AppField name="branchMembership">
        {(field) => <field.SelectBranchField perspective="administrate" />}
      </form.AppField>
      <Group>
        <Button variant="subtle" onClick={() => onClose()}>
          Avbryt
        </Button>
        <Button loading={updateBranchMembershipMutation.isPending} onClick={form.handleSubmit}>
          Lagre
        </Button>
      </Group>
    </Stack>
  );
}
