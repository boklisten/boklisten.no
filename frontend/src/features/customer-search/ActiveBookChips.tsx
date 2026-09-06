import type { ActiveCustomerItem } from "@boklisten/backend/shared/customer-item/active-customer-item";
import type { CustomerItemType } from "@boklisten/backend/shared/customer-item/customer-item-type";
import { IconBuildingStore, IconCalendarDue } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import ChipButton from "@/shared/components/ChipButton";
import ChangeBranchModal from "@/shared/components/corrections/ChangeBranchModal";
import ChangeDeadlineModal from "@/shared/components/corrections/ChangeDeadlineModal";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const TYPE_LABELS: Record<CustomerItemType, string> = {
  rent: "Lån",
  "partly-payment": "Delbetaling",
};

export function isOverdue(deadline: string | Date): boolean {
  return norwegianTime(deadline).endOf("day").isBefore(norwegianTime());
}

/**
 * The write behind both chips. The book is listed by customer here, by blid in Boksøk and by
 * branch on the branch pages, so all of those go stale.
 */
function useActiveBookUpdate(successMessage: string, onSaved: () => void) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  return useMutation(
    api.blidSearch.updateActiveItem.mutationOptions({
      onSuccess: () => {
        showSuccessNotification(successMessage);
        onSaved();
      },
      onError: (error) =>
        showErrorNotification(errorMessage(error, "Klarte ikke oppdatere utlånet")),
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: api.customerItems.getActiveCustomerItemsForCustomer.pathKey(),
          }),
          queryClient.invalidateQueries({ queryKey: api.blidSearch.lookup.pathKey() }),
          queryClient.invalidateQueries({ queryKey: api.branchBooks.getActiveBooks.pathKey() }),
          queryClient.invalidateQueries({
            queryKey: api.branchBooks.getActiveBookDetails.pathKey(),
          }),
        ]),
    }),
  );
}

/**
 * The branch a handed-out book belongs to, as an editable chip. Any employee may move it; the
 * change is monitored, so the modal says so before the form.
 */
export function ActiveBookBranchChip({ book }: { book: ActiveCustomerItem }) {
  const [editing, setEditing] = useState(false);
  const updateMutation = useActiveBookUpdate("Filialen ble endret", () => setEditing(false));
  return (
    <>
      <ChipButton
        icon={IconBuildingStore}
        color="gray"
        title="Endre filial"
        onClick={() => setEditing(true)}
      >
        {book.handoutBranch?.name ?? "Velg filial"}
      </ChipButton>
      {editing && (
        <ChangeBranchModal
          currentBranchId={book.handoutBranch?.id ?? null}
          description="Boka regnes som utdelt fra denne filialen"
          isPending={updateMutation.isPending}
          onClose={() => setEditing(false)}
          onSubmit={(branchId) =>
            updateMutation.mutate({ body: { customerItemId: book.id, branchId } })
          }
        />
      )}
    </>
  );
}

/**
 * When a handed-out book is due back, as an editable chip: red once the deadline has passed.
 * Unlike "Forleng", this moves the date without charging the customer, so it is monitored and
 * the modal says so before the form.
 */
export function ActiveBookDeadlineChip({ book }: { book: ActiveCustomerItem }) {
  const [editing, setEditing] = useState(false);
  const updateMutation = useActiveBookUpdate("Fristen ble endret", () => setEditing(false));
  return (
    <>
      <ChipButton
        icon={IconCalendarDue}
        color={isOverdue(book.deadline) ? "red" : "gray"}
        title="Endre frist"
        onClick={() => setEditing(true)}
      >
        {TYPE_LABELS[book.type]} til {norwegianTime(book.deadline).format("DD.MM.YYYY")}
      </ChipButton>
      {editing && (
        <ChangeDeadlineModal
          currentDeadline={book.deadline}
          description="Datoen boka skal leveres tilbake innen"
          isPending={updateMutation.isPending}
          onClose={() => setEditing(false)}
          onSubmit={(deadline) =>
            updateMutation.mutate({ body: { customerItemId: book.id, deadline } })
          }
        />
      )}
    </>
  );
}
