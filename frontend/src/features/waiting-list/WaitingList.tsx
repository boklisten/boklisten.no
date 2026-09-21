import { useQuery } from "@tanstack/react-query";

import WaitingListTable from "@/features/waiting-list/WaitingListTable";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { api } from "@/shared/utils/apiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

export default function WaitingList() {
  const {
    data: items,
    isLoading: isLoadingItems,
    error: itemsError,
  } = useQuery(api.items.index.queryOptions());

  const {
    data: branches,
    isLoading: isLoadingBranches,
    error: branchesError,
  } = useQuery(api.branches.indexPublic.queryOptions());

  const {
    data: waitingList,
    isLoading: isLoadingWaitingList,
    error: waitingListError,
  } = useQuery(api.waitingListCustomers.index.queryOptions());

  if (itemsError || branchesError || waitingListError) {
    return (
      <ErrorAlert title="Klarte ikke laste inn venteliste">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }

  return (
    <WaitingListTable
      items={items ?? []}
      branches={branches ?? []}
      waitingList={waitingList ?? []}
      loading={isLoadingItems || isLoadingBranches || isLoadingWaitingList}
    />
  );
}
