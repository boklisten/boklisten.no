import { Button, Group, Skeleton, Table, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import type { Route } from "@boklisten/backend/registry";

import MoveBranchMemberModal from "@/features/branches/MoveBranchMemberModal";
import CustomerLink from "@/features/kasse/CustomerLink";
import useBranchNames from "@/features/user-management/useBranchNames";

type BranchMember = Route.Response<"branch_members.index">["members"][number];

const SKELETON_ROWS = 8;

/**
 * The members loaded so far, by name, with the school each belongs to when the list spans more
 * than one. The list grows a page at a time on request rather than on scroll, so the sections
 * below it stay within reach on the root, where it is thousands of rows long.
 */
export default function BranchMembersTable({
  branchId,
  members,
  total,
  showSchool,
  isLoading,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  branchId: string;
  members: BranchMember[];
  total: number | undefined;
  /** Off for a list whose rows all belong to the same node, where the column would repeat the heading. */
  showSchool: boolean;
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  const branchNames = useBranchNames();
  return (
    <>
      <Table.ScrollContainer minWidth={560} maxHeight={520}>
        <Table verticalSpacing="sm" highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Navn</Table.Th>
              <Table.Th>Fødselsår</Table.Th>
              {showSchool && <Table.Th>Skole</Table.Th>}
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading &&
              Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <Table.Tr key={index}>
                  <Table.Td colSpan={showSchool ? 4 : 3}>
                    <Skeleton height={20} radius="sm" />
                  </Table.Td>
                </Table.Tr>
              ))}
            {!isLoading && members.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={showSchool ? 4 : 3}>
                  <Text c="dimmed" fs="italic">
                    Ingen medlemmer å vise.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {members.map((member) => {
              const school = branchNames.get(member.branchMembershipId);
              return (
                <Table.Tr key={member.id}>
                  <Table.Td>
                    <CustomerLink userId={member.id} fw={400}>
                      {member.name || "Uten navn"}
                    </CustomerLink>
                  </Table.Td>
                  <Table.Td>{member.yearOfBirth}</Table.Td>
                  {showSchool && (
                    <Table.Td>
                      {school ?? (
                        <Text span c="dimmed">
                          Ingen skole
                        </Text>
                      )}
                    </Table.Td>
                  )}
                  <Table.Td ta="right">
                    <Button
                      variant="subtle"
                      size="compact-sm"
                      onClick={() => {
                        const modalId = modals.open({
                          title: `Flytt ${member.name || "medlemmet"}`,
                          children: (
                            <MoveBranchMemberModal
                              branchId={branchId}
                              memberId={member.id}
                              onClose={() => modals.close(modalId)}
                            />
                          ),
                        });
                      }}
                    >
                      Flytt
                    </Button>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {!isLoading && members.length > 0 && (
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Viser {members.length.toLocaleString("nb-NO")} av{" "}
            {(total ?? members.length).toLocaleString("nb-NO")}
          </Text>
          {hasMore && (
            <Button variant="light" loading={isLoadingMore} onClick={onLoadMore}>
              Vis flere
            </Button>
          )}
        </Group>
      )}
    </>
  );
}
