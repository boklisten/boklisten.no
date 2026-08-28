import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import {
  Button,
  Checkbox,
  Loader,
  Modal,
  Pill,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { PERMISSION_LABELS } from "@/features/user-management/permissionLabels";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const MIN_SEARCH_LENGTH = 3;
const MAX_RESULTS = 8;

const GRANTABLE_PERMISSIONS = (["employee", "manager", "admin"] as const).map((permission) => ({
  value: permission,
  label: PERMISSION_LABELS[permission],
}));

interface SelectedUser {
  detailsId: string;
  name: string;
  email: string;
}

export default function AddEmployeesModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const { api, client } = useApiClient();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchValue.trim(), 250);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [permission, setPermission] = useState<UserPermission>("employee");

  const searchActive = debouncedSearch.length >= MIN_SEARCH_LENGTH;
  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["userDetail", "search", debouncedSearch],
    queryFn: async () =>
      (await client.api.userDetail.search({ body: { searchStr: debouncedSearch } })) ?? [],
    enabled: searchActive,
  });

  const addMutation = useMutation({
    mutationFn: (input: { detailsIds: string[]; permission: UserPermission }) =>
      client.api.userManagement.setPermission({ body: input }),
    onSuccess: async () => {
      showSuccessNotification(
        selectedUsers.length === 1
          ? `${selectedUsers[0]?.name} fikk tilgangsnivået ${PERMISSION_LABELS[permission]}`
          : `${selectedUsers.length} brukere fikk tilgangsnivået ${PERMISSION_LABELS[permission]}`,
      );
      closeAndReset();
      await queryClient.invalidateQueries({
        queryKey: api.userManagement.employees.queryKey(),
      });
    },
    onError: (error) => showErrorNotification(errorMessage(error, "Klarte ikke å gi tilgang")),
  });

  function closeAndReset() {
    onClose();
    setSearchValue("");
    setSelectedUsers([]);
    setPermission("employee");
  }

  function toggleUser(user: SelectedUser, checked: boolean) {
    setSelectedUsers((previous) =>
      checked
        ? [...previous, user]
        : previous.filter((selected) => selected.detailsId !== user.detailsId),
    );
  }

  const isSelected = (detailsId: string) =>
    selectedUsers.some((selected) => selected.detailsId === detailsId);

  return (
    <Modal opened={opened} onClose={closeAndReset} title={"Legg til ansatte"} size={"lg"}>
      <Stack gap={"sm"}>
        <TextInput
          label={"Søk etter kunder"}
          placeholder={"Navn, e-post eller telefon"}
          leftSection={<IconSearch size={16} />}
          rightSection={isFetching ? <Loader size={"xs"} /> : undefined}
          value={searchValue}
          onChange={(event) => setSearchValue(event.currentTarget.value)}
          data-autofocus
        />
        {searchActive && searchResults && searchResults.length === 0 && (
          <Text size={"sm"} c={"dimmed"} fs={"italic"}>
            Ingen kunder matcher søket.
          </Text>
        )}
        {searchResults && searchResults.length > 0 && (
          <Stack gap={"xs"}>
            {searchResults.slice(0, MAX_RESULTS).map((result) => (
              <Checkbox
                key={result.id}
                checked={isSelected(result.id)}
                onChange={(event) =>
                  toggleUser(
                    { detailsId: result.id, name: result.name ?? "", email: result.email },
                    event.currentTarget.checked,
                  )
                }
                label={
                  <>
                    <Text span size={"sm"} fw={600}>
                      {result.name || result.email}
                    </Text>
                    {result.permission !== "customer" && (
                      <Text span size={"sm"} c={"dimmed"}>
                        {" "}
                        · er allerede {PERMISSION_LABELS[result.permission]}
                      </Text>
                    )}
                    <Text size={"xs"} c={"dimmed"} style={{ overflowWrap: "anywhere" }}>
                      {result.email}
                    </Text>
                  </>
                }
              />
            ))}
          </Stack>
        )}
        {selectedUsers.length > 0 && (
          <Pill.Group>
            {selectedUsers.map((user) => (
              <Pill key={user.detailsId} withRemoveButton onRemove={() => toggleUser(user, false)}>
                {user.name || user.email}
              </Pill>
            ))}
          </Pill.Group>
        )}
        <Select
          label={"Tilgangsnivå"}
          description={"Alle valgte brukere får samme tilgangsnivå"}
          data={GRANTABLE_PERMISSIONS}
          value={permission}
          allowDeselect={false}
          onChange={(value) =>
            setPermission(GRANTABLE_PERMISSIONS.find((p) => p.value === value)?.value ?? "employee")
          }
        />
        <Button
          disabled={selectedUsers.length === 0}
          loading={addMutation.isPending}
          onClick={() =>
            addMutation.mutate({
              detailsIds: selectedUsers.map((user) => user.detailsId),
              permission,
            })
          }
        >
          {selectedUsers.length === 1
            ? "Gi tilgang til 1 bruker"
            : `Gi tilgang til ${selectedUsers.length} brukere`}
        </Button>
      </Stack>
    </Modal>
  );
}
