import { useAppForm } from "@/shared/hooks/form";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { api, apiClient } from "@/shared/utils/apiClient";

/** Picking a branch moves the member at once (see `useAutoSave`); they leave the list, so it closes. */
export default function MoveBranchMemberModal({
  branchId,
  memberId,
  onClose,
}: {
  branchId: string;
  memberId: string;
  onClose: () => void;
}) {
  const form = useAppForm(
    useAutoSave({
      defaultValues: { branchMembership: branchId },
      persist: ({ branchMembership }) =>
        apiClient.api.branchMembers.update({ body: { userId: memberId, branchMembership } }),
      invalidates: [api.branchMembers.index.queryKey({ params: { branchId } })],
      onSaved: onClose,
    }),
  );

  return (
    <form.AppField name="branchMembership">
      {(field) => <field.SelectBranchField perspective="administrate" />}
    </form.AppField>
  );
}
