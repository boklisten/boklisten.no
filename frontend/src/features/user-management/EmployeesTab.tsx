import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import {
  Box,
  Button,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconShieldStar, IconUserCog, IconUserPlus, IconUserShield } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import AddEmployeesModal from "@/features/user-management/AddEmployeesModal";
import { PERMISSION_LABELS } from "@/features/user-management/permissionLabels";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import StatTile from "@/shared/components/StatTile";
import useApiClient from "@/shared/hooks/useApiClient";
import useAuth from "@/shared/hooks/useAuth";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { norwegianTime } from "@/shared/utils/dayjs";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const PERMISSION_OPTIONS = (["customer", "employee", "manager", "admin"] as const).map(
  (permission) => ({ value: permission, label: PERMISSION_LABELS[permission] }),
);

function lastActiveLabel(lastActive: string | null) {
  return lastActive ? norwegianTime(lastActive).fromNow() : "Aldri";
}

export default function EmployeesTab() {
  const { api, client } = useApiClient();
  const { detailsId: myDetailsId } = useAuth();
  const queryClient = useQueryClient();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const {
    data: employees,
    isPending,
    isError,
  } = useQuery(api.userManagement.employees.queryOptions());

  const permissionMutation = useMutation({
    mutationFn: (input: { detailsIds: string[]; permission: UserPermission }) =>
      client.api.userManagement.setPermission({ body: input }),
    onSuccess: async () => {
      showSuccessNotification("Tilgangsnivået ble endret");
      await queryClient.invalidateQueries({
        queryKey: api.userManagement.employees.queryKey(),
      });
    },
    onError: (error) =>
      showErrorNotification(errorMessage(error, "Klarte ikke å endre tilgangsnivået")),
  });

  function confirmPermissionChange(
    employee: { detailsId: string; name: string },
    permission: UserPermission,
  ) {
    const isSelf = employee.detailsId === myDetailsId;
    modals.openConfirmModal({
      title: "Endre tilgangsnivå",
      children: (
        <Stack gap={"xs"}>
          <Text size={"sm"}>
            {permission === "customer"
              ? `${employee.name} mister ansatt-tilgangen og blir vanlig kunde.`
              : `${employee.name} får tilgangsnivået ${PERMISSION_LABELS[permission]}.`}
          </Text>
          {isSelf && (
            <Text size={"sm"} c={"red"} fw={600}>
              Dette er din egen konto. Senker du ditt eget tilgangsnivå, mister du tilgangen til
              denne siden og kan ikke angre selv.
            </Text>
          )}
        </Stack>
      ),
      labels: { confirm: "Endre tilgangsnivå", cancel: "Avbryt" },
      confirmProps: { color: isSelf || permission === "customer" ? "red" : "blue" },
      onConfirm: () => permissionMutation.mutate({ detailsIds: [employee.detailsId], permission }),
    });
  }

  if (isError) {
    return <ErrorAlert title={"Kunne ikke laste ansatte"}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
  }
  if (isPending) {
    return (
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height={100} radius={"md"} />
          ))}
        </SimpleGrid>
        <Skeleton height={300} radius={"md"} />
      </Stack>
    );
  }

  const countByPermission = (permission: UserPermission) =>
    employees.filter((employee) => employee.permission === permission).length;

  return (
    <Stack gap={"lg"}>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <StatTile
          label={"Ansatte"}
          value={countByPermission("employee")}
          icon={<IconUserCog />}
          color={"blue"}
        />
        <StatTile
          label={"Managere"}
          value={countByPermission("manager")}
          icon={<IconUserShield />}
          color={"grape"}
        />
        <StatTile
          label={"Administratorer"}
          value={countByPermission("admin")}
          icon={<IconShieldStar />}
          color={"red"}
        />
      </SimpleGrid>
      <Box>
        <Button leftSection={<IconUserPlus size={18} />} onClick={() => setAddModalOpen(true)}>
          Legg til ansatte
        </Button>
      </Box>
      <Table.ScrollContainer minWidth={560}>
        <Table verticalSpacing={"sm"} highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Navn</Table.Th>
              <Table.Th>Tilgangsnivå</Table.Th>
              <Table.Th>Sist aktiv</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {employees.map((employee) => (
              <Table.Tr key={employee.detailsId}>
                <Table.Td>
                  <Text size={"sm"} fw={600}>
                    {employee.name || "Uten navn"}
                  </Text>
                  <Text size={"xs"} c={"dimmed"} style={{ overflowWrap: "anywhere" }}>
                    {employee.email}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    aria-label={`Tilgangsnivå for ${employee.name || employee.email}`}
                    data={PERMISSION_OPTIONS}
                    value={employee.permission}
                    allowDeselect={false}
                    w={160}
                    onChange={(value) => {
                      if (value && value !== employee.permission) {
                        confirmPermissionChange(employee, value);
                      }
                    }}
                  />
                </Table.Td>
                <Table.Td>
                  <Tooltip
                    label={
                      employee.lastActive
                        ? norwegianTime(employee.lastActive).format("DD.MM.YYYY HH:mm")
                        : "Har aldri logget inn"
                    }
                  >
                    <Text size={"sm"}>{lastActiveLabel(employee.lastActive)}</Text>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <AddEmployeesModal opened={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </Stack>
  );
}
