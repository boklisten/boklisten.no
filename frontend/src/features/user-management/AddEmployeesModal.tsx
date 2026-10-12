import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { Box, Button, Modal, MultiSelect, Select, Stack, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { PERMISSION_LABELS } from "@/features/user-management/permissionLabels";
import { api, apiClient } from "@/shared/utils/apiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const MIN_SEARCH_LENGTH = 3;
const MAX_RESULTS = 8;

const GRANTABLE_PERMISSIONS = (["employee", "admin"] as const).map((permission) => ({
  value: permission,
  label: PERMISSION_LABELS[permission],
}));

interface UserOption {
  value: string;
  label: string;
  email: string;
  permission: UserPermission;
}

export default function AddEmployeesModal({
  opened,
  onClose,
  branchId,
  canGrantAdmin,
}: {
  opened: boolean;
  onClose: () => void;
  /** The node the list is on, which is where a new employee works from. To home someone elsewhere, add them from that node. */
  branchId: string;
  /** Admins work from the root, so only the root's list offers that level. */
  canGrantAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchValue.trim(), 250);
  // The picked users keep their option so the pill still has a name once the search moves on.
  const [selected, setSelected] = useState<UserOption[]>([]);
  const [permission, setPermission] = useState<UserPermission>("employee");
  const { data: branches } = useQuery(api.branches.index.queryOptions());
  const branchName = branches?.find((branch) => branch.id === branchId)?.name;

  const searchActive = debouncedSearch.length >= MIN_SEARCH_LENGTH;
  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["users", "search", debouncedSearch],
    queryFn: async () =>
      (await apiClient.api.users.search({ query: { q: debouncedSearch } })) ?? [],
    enabled: searchActive,
  });
  const hits: UserOption[] = (searchResults ?? []).slice(0, MAX_RESULTS).map((user) => ({
    value: user.id,
    label: user.name === null || user.name === "" ? user.email : user.name,
    email: user.email,
    permission: user.permission,
  }));
  const options = [
    ...selected,
    ...hits.filter((hit) => !selected.some((s) => s.value === hit.value)),
  ];

  const addMutation = useMutation({
    mutationFn: (input: {
      userIds: string[];
      permission: UserPermission;
      employeeBranchId?: string;
    }) => apiClient.api.users.setPermission({ body: input }),
    onSuccess: async () => {
      showSuccessNotification(
        selected.length === 1
          ? `${selected[0]?.label} fikk tilgangsnivået ${PERMISSION_LABELS[permission]}`
          : `${selected.length} brukere fikk tilgangsnivået ${PERMISSION_LABELS[permission]}`,
      );
      closeAndReset();
      await queryClient.invalidateQueries({ queryKey: api.users.employees.pathKey() });
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke å gi tilgang")),
  });

  function closeAndReset() {
    onClose();
    setSearchValue("");
    setSelected([]);
    setPermission("employee");
  }

  return (
    <Modal
      opened={opened}
      onClose={closeAndReset}
      title={branchName ? `Legg til ansatte på ${branchName}` : "Legg til ansatte"}
      size="lg"
    >
      <Stack gap="sm">
        <MultiSelect
          label="Brukere"
          placeholder={selected.length === 0 ? "Navn, e-post eller telefon" : undefined}
          leftSection={<IconSearch size={16} />}
          data={options}
          value={selected.map((user) => user.value)}
          onChange={(ids) =>
            setSelected(ids.flatMap((id) => options.find((option) => option.value === id) ?? []))
          }
          searchable
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          // The server does the matching; the options are the hits as they came.
          filter={({ options: current }) => current}
          hidePickedOptions
          loading={isFetching}
          nothingFoundMessage={
            searchActive && !isFetching && hits.length === 0
              ? "Ingen brukere matcher søket"
              : undefined
          }
          renderOption={({ option }) => {
            const user = options.find((candidate) => candidate.value === option.value);
            if (!user) {
              return option.label;
            }
            return (
              <Box>
                <Text size="sm" fw={600}>
                  {user.label}
                  {user.permission !== "customer" && (
                    <Text span size="sm" c="dimmed" fw={400}>
                      {" "}
                      · er allerede {PERMISSION_LABELS[user.permission]}
                    </Text>
                  )}
                </Text>
                <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>
                  {user.email}
                </Text>
              </Box>
            );
          }}
          data-autofocus
        />
        <Select
          label="Tilgangsnivå"
          data={canGrantAdmin ? GRANTABLE_PERMISSIONS : GRANTABLE_PERMISSIONS.slice(0, 1)}
          value={permission}
          allowDeselect={false}
          onChange={(value) =>
            setPermission(GRANTABLE_PERMISSIONS.find((p) => p.value === value)?.value ?? "employee")
          }
        />
        <Button
          disabled={selected.length === 0}
          loading={addMutation.isPending}
          onClick={() =>
            addMutation.mutate({
              userIds: selected.map((user) => user.value),
              permission,
              ...(permission === "employee" ? { employeeBranchId: branchId } : {}),
            })
          }
        >
          {selected.length === 1
            ? "Gi tilgang til 1 bruker"
            : `Gi tilgang til ${selected.length} brukere`}
        </Button>
      </Stack>
    </Modal>
  );
}
