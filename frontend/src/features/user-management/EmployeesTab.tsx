import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { Button, Group, Select, Skeleton, Stack, Table, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconUserPlus } from "@tabler/icons-react";
import type { Route } from "@tuyau/core/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import TreeScopeSection from "@/features/branches/TreeScopeSection";
import CustomerAvatar from "@/features/customer-search/CustomerAvatar";
import AddEmployeesModal from "@/features/user-management/AddEmployeesModal";
import EmployeeBranchPicker from "@/features/user-management/EmployeeBranchPicker";
import { lastActiveLabel } from "@/features/user-management/lastActive";
import { PERMISSION_LABELS } from "@/features/user-management/permissionLabels";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import EntityLink from "@/shared/components/EntityLink";
import useAuth from "@/shared/hooks/useAuth";
import { api, apiClient } from "@/shared/utils/apiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

type EmployeeRow = Route.Response<"users.employees">[number];

const PERMISSION_OPTIONS = (["customer", "employee", "admin"] as const).map((permission) => ({
  value: permission,
  label: PERMISSION_LABELS[permission],
}));
/** Admins work from the root, so only its Ansatte tab offers the level; elsewhere a promotion would move the row away. */
const NON_ROOT_PERMISSION_OPTIONS = PERMISSION_OPTIONS.filter((option) => option.value !== "admin");

/**
 * The Ansatte tab of a node, read as an audit: everyone who can see the node's data, grouped by
 * how much of it. Staff homed above see all of it because they are employed at the parent or
 * higher; staff homed here see all of it
 * and are managed here; staff homed below see only their own part. The panels above and below
 * start closed and their rows are read-only, each node a link to the tab where it is managed.
 */
export default function EmployeesTab({ branchId, isRoot }: { branchId: string; isRoot: boolean }) {
  const { userId: myUserId } = useAuth();
  const queryClient = useQueryClient();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const {
    data: employees,
    isPending,
    isError,
  } = useQuery(api.users.employees.queryOptions({ query: { branchId } }));
  const { data: branches } = useQuery(api.branches.index.queryOptions());
  const branchNames = new Map((branches ?? []).map((branch) => [branch.id, branch.name]));

  const permissionMutation = useMutation({
    mutationFn: (input: { userIds: string[]; permission: UserPermission }) =>
      apiClient.api.users.setPermission({ body: input }),
    onSuccess: async () => {
      showSuccessNotification("Tilgangsnivået ble endret");
      await queryClient.invalidateQueries({ queryKey: api.users.employees.pathKey() });
    },
    onError: (error) =>
      showErrorNotification(errorMessage(error, "Klarte ikke å endre tilgangsnivået")),
  });

  const branchMutation = useMutation({
    mutationFn: (input: {
      userIds: string[];
      permission: UserPermission;
      employeeBranchId: string;
    }) => apiClient.api.users.setPermission({ body: input }),
    onSuccess: async (_, input) => {
      showSuccessNotification(
        `Flyttet til ${branchNames.get(input.employeeBranchId) ?? "en annen filial"}`,
      );
      await queryClient.invalidateQueries({ queryKey: api.users.employees.pathKey() });
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke å endre filialen")),
  });

  function confirmPermissionChange(employee: EmployeeRow, permission: UserPermission) {
    const isSelf = employee.userId === myUserId;
    modals.openConfirmModal({
      title: "Endre tilgangsnivå",
      children: (
        <Stack gap="xs">
          <Text size="sm">
            {permission === "customer"
              ? `${employee.name} mister ansatt-tilgangen og blir vanlig kunde.`
              : `${employee.name} får tilgangsnivået ${PERMISSION_LABELS[permission]}.`}
          </Text>
          {isSelf && (
            <Text size="sm" c="red" fw={600}>
              Dette er din egen konto. Senker du ditt eget tilgangsnivå, mister du tilgangen til
              denne siden og kan ikke angre selv.
            </Text>
          )}
        </Stack>
      ),
      labels: { confirm: "Endre tilgangsnivå", cancel: "Avbryt" },
      confirmProps: { color: isSelf || permission === "customer" ? "red" : "blue" },
      onConfirm: () => permissionMutation.mutate({ userIds: [employee.userId], permission }),
    });
  }

  if (isError) {
    return <ErrorAlert title="Kunne ikke laste ansatte">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }
  if (isPending) {
    return (
      <Stack>
        <Skeleton height={36} width={160} radius="md" />
        <Skeleton height={200} radius="md" />
        <Skeleton height={200} radius="md" />
      </Stack>
    );
  }

  const rowsOf = (relation: EmployeeRow["relation"]) =>
    employees.filter((employee) => employee.relation === relation);

  function employeeTable(rows: EmployeeRow[], editable: boolean) {
    if (rows.length === 0) {
      return (
        <Text size="sm" c="dimmed" fs="italic">
          Ingen ansatte
        </Text>
      );
    }
    return (
      <Table.ScrollContainer minWidth={760}>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Navn</Table.Th>
              <Table.Th>Tilgangsnivå</Table.Th>
              <Table.Th>Filial</Table.Th>
              <Table.Th>Sist aktiv</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((employee) => (
              <Table.Tr key={employee.userId}>
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <CustomerAvatar
                      userId={employee.userId}
                      name={employee.name || employee.email}
                      enlargeable
                    />
                    <Stack gap={0} miw={0}>
                      <Text size="sm" lh={1.3}>
                        <EntityLink to="/admin/kasse" search={{ kunde: employee.userId }}>
                          {employee.name || "Uten navn"}
                        </EntityLink>
                      </Text>
                      <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>
                        {employee.email}
                      </Text>
                    </Stack>
                  </Group>
                </Table.Td>
                <Table.Td>
                  {editable ? (
                    <Select
                      aria-label={`Tilgangsnivå for ${employee.name || employee.email}`}
                      data={isRoot ? PERMISSION_OPTIONS : NON_ROOT_PERMISSION_OPTIONS}
                      value={employee.permission}
                      allowDeselect={false}
                      w={160}
                      onChange={(value) => {
                        if (value && value !== employee.permission) {
                          confirmPermissionChange(employee, value);
                        }
                      }}
                    />
                  ) : (
                    <Text size="sm">{PERMISSION_LABELS[employee.permission]}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {editable ? (
                    // An admin works from the root; the node is theirs to see, not to change.
                    <EmployeeBranchPicker
                      aria-label={`Filial for ${employee.name || employee.email}`}
                      w={220}
                      value={employee.employeeBranchId}
                      disabled={employee.permission === "admin"}
                      onChange={(employeeBranchId) =>
                        branchMutation.mutate({
                          userIds: [employee.userId],
                          permission: employee.permission,
                          employeeBranchId,
                        })
                      }
                    />
                  ) : (
                    <Text size="sm">
                      <EntityLink
                        to="/admin/database/filialer"
                        search={(previous) => ({
                          ...previous,
                          filial: employee.employeeBranchId,
                          filialFane: "employees",
                        })}
                      >
                        {branchNames.get(employee.employeeBranchId) ?? "Ukjent filial"}
                      </EntityLink>
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{lastActiveLabel(employee.lastActive)}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    );
  }

  return (
    <Stack gap="xl">
      {!isRoot && (
        <TreeScopeSection
          direction="above"
          title="Overordnede filialer"
          count={rowsOf("above").length}
          collapsible
        >
          {employeeTable(rowsOf("above"), false)}
        </TreeScopeSection>
      )}
      <TreeScopeSection
        direction="here"
        title="Denne filialen"
        count={rowsOf("here").length}
        actions={
          // Styled like "Nytt årskull" on the branch title: a light button at the right end of the heading.
          <Button
            variant="light"
            leftSection={<IconUserPlus size={18} />}
            onClick={() => setAddModalOpen(true)}
          >
            Legg til ansatte
          </Button>
        }
      >
        {employeeTable(rowsOf("here"), true)}
      </TreeScopeSection>
      <TreeScopeSection
        direction="below"
        title="Underordnede filialer"
        count={rowsOf("below").length}
        collapsible
      >
        {employeeTable(rowsOf("below"), false)}
      </TreeScopeSection>
      <AddEmployeesModal
        opened={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        branchId={branchId}
        canGrantAdmin={isRoot}
      />
    </Stack>
  );
}
