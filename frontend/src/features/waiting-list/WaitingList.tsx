import { useQuery } from "@tanstack/react-query";

import WaitingListTable from "@/features/waiting-list/WaitingListTable";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

export default function WaitingList() {
  const { api } = useApiClient();

  const {
    data: items,
    isLoading: isLoadingItems,
    error: itemsError,
  } = useQuery(api.items.get.queryOptions());

  const {
    data: branches,
    isLoading: isLoadingBranches,
    error: branchesError,
  } = useQuery(api.branches.getPublic.queryOptions());

  const {
    data: waitingList,
    isLoading: isLoadingWaitingList,
    error: waitingListError,
  } = useQuery(api.waitingListCustomer.getAll.queryOptions());

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
