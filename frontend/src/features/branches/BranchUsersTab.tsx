import type { MemberScope } from "@boklisten/backend/shared/branch-members";
import { Button, Group, Stack } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import BranchMembersTable from "@/features/branches/BranchMembersTable";
import { invalidateBranchMembership } from "@/features/branches/branchMembersQueries";
import TreeScopeSection from "@/features/branches/TreeScopeSection";
import UploadBranchUsers from "@/features/branches/UploadBranchUsers";
import DuplicateCustomers from "@/features/user-management/DuplicateCustomers";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { api, apiClient } from "@/shared/utils/apiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/** One list of a node's members, a page at a time. Membership alone decides who is listed. */
function useMembers(branchId: string, scope: MemberScope) {
  const query = useInfiniteQuery(
    api.branchMembers.index.infiniteQueryOptions(
      { params: { branchId }, query: { scope } },
      {
        pageParamKey: "cursor",
        initialPageParam: "",
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );
  return {
    members: query.data?.pages.flatMap((page) => page.members) ?? [],
    counts: query.data?.pages[0]?.counts,
    isLoading: query.isLoading,
    isError: query.isError,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
  };
}

/**
 * The Brukere tab of a node: who belongs here, as two lists, the node's own members and those of
 * the branches below, each closed until asked for. The class list upload and the duplicate
 * finder follow, over the same people; the numbers about them live on Innsikt.
 */
export default function BranchUsersTab({
  branchId,
  isRoot,
}: {
  branchId: string;
  /** The root has nothing above it to move members to, so it offers no removal. */
  isRoot: boolean;
}) {
  const queryClient = useQueryClient();
  const direct = useMembers(branchId, "direct");
  const descendants = useMembers(branchId, "descendants");
  const counts = direct.counts ?? descendants.counts;

  const removeMembersMutation = useMutation({
    mutationFn: async (scope: "direct" | "indirect") =>
      scope === "direct"
        ? apiClient.api.branchMembers.destroyDirect({ params: { branchId } })
        : apiClient.api.branchMembers.destroyIndirect({ params: { branchId } }),
    onSuccess: () => showSuccessNotification("Medlemsliste ble oppdatert"),
    onError: () => showErrorNotification("Klarte ikke oppdatere medlemsliste"),
    onSettled: () => invalidateBranchMembership(queryClient),
  });

  function removeMembersButton(scope: "direct" | "indirect", subject: string) {
    return (
      <Group justify="flex-end">
        <Button
          variant="subtle"
          c="red"
          loading={removeMembersMutation.isPending && removeMembersMutation.variables === scope}
          onClick={() =>
            modals.openConfirmModal({
              title: "Bekreft fjerning av medlemmer",
              children: `Du er i ferd med å fjerne medlemmene av ${subject}. De blir stående uten skole. Dette kan ikke angres.`,
              labels: { cancel: "Avbryt", confirm: "Bekreft" },
              onConfirm: () => removeMembersMutation.mutate(scope),
            })
          }
        >
          Fjern medlemmer
        </Button>
      </Group>
    );
  }

  function membersList(
    list: ReturnType<typeof useMembers>,
    total: number | undefined,
    showSchool: boolean,
  ) {
    if (list.isError) {
      return <ErrorAlert title="Klarte ikke laste medlemmene">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
    }
    return (
      <BranchMembersTable
        branchId={branchId}
        members={list.members}
        total={total}
        showSchool={showSchool}
        isLoading={list.isLoading}
        hasMore={list.hasNextPage}
        isLoadingMore={list.isFetchingNextPage}
        onLoadMore={list.fetchNextPage}
      />
    );
  }

  return (
    <Stack gap="xl">
      <TreeScopeSection
        direction="here"
        title="Medlemmer av denne filialen"
        count={counts?.direct}
        collapsible
      >
        <Stack gap="xs">
          {!isRoot && (counts?.direct ?? 0) > 0 && removeMembersButton("direct", "denne filialen")}
          {/* Every direct member belongs to this node, so the school column would repeat the heading. */}
          {membersList(direct, counts?.direct, false)}
        </Stack>
      </TreeScopeSection>
      <TreeScopeSection
        direction="below"
        title="Medlemmer av underordnede filialer"
        count={counts?.indirect}
        collapsible
      >
        <Stack gap="xs">
          {!isRoot &&
            (counts?.indirect ?? 0) > 0 &&
            removeMembersButton("indirect", "denne filialens underfilialer")}
          {membersList(descendants, counts?.indirect, true)}
        </Stack>
      </TreeScopeSection>
      <UploadBranchUsers branchId={branchId} />
      <DuplicateCustomers branchId={branchId} />
    </Stack>
  );
}
