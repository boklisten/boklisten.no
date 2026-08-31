import type { Branch } from "@boklisten/backend/shared/branch";
import { futureRentPeriods } from "@boklisten/backend/shared/rent-periods";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Button, Group, Modal, Select, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";

/** What the employee picked for a book that is handed out without an order. */
export interface NoOrderChoice {
  branchId: string;
  /** ISO date matching one of the branch's future rent periods. */
  deadline: string;
}

/**
 * The first branch from the customer's own and upwards through the tree that has a future rent
 * period, so the deadline pick starts where the customer belongs.
 */
function defaultBranchId(
  branches: Branch[],
  startBranchId: string | undefined,
  now: Date,
): string | null {
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const visited = new Set<string>();
  let current = startBranchId === undefined ? undefined : byId.get(startBranchId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (futureRentPeriods(current, now).length > 0) return current.id;
    current = current.parentBranch === undefined ? undefined : byId.get(current.parentBranch);
  }
  return null;
}

function deadlineOptions(branch: Branch | undefined, now: Date) {
  if (!branch) return [];
  return futureRentPeriods(branch, now).map((period) => ({
    value: new Date(period.date).toISOString(),
    label: `Lån til ${norwegianTime(period.date).format("DD.MM.YYYY")}`,
  }));
}

function HandoutForm({
  blid,
  title,
  customer,
  zIndex,
  onClose,
}: {
  blid: string;
  title: string;
  customer: UserDetail;
  zIndex: number;
  onClose: (choice: NoOrderChoice | null) => void;
}) {
  // The modal sits above Mantine's default combobox layer, so the dropdowns must be lifted with it
  const comboboxProps = { zIndex: zIndex + 1 };
  const { api } = useApiClient();
  const { data: branches } = useQuery(api.branches.getAll.queryOptions());
  const now = new Date();
  const selectableBranches = (branches ?? []).filter(
    (branch) => futureRentPeriods(branch, now).length > 0,
  );

  const [branchId, setBranchId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  // Branches load async, so the prefill has to wait for them instead of living in useState's
  // initializer. Only fills while the employee has not touched the picker. The walk gets the full
  // tree: a customer's own branch may lack rent periods while a parent has them.
  const initialBranchId =
    branchId ?? defaultBranchId(branches ?? [], customer.branchMembership, now);
  const selectedBranch = selectableBranches.find((branch) => branch.id === initialBranchId);
  const periods = deadlineOptions(selectedBranch, now);
  const selectedDeadline = deadline ?? periods[0]?.value ?? null;

  return (
    <Stack>
      <Text>
        <Text span fw={700}>
          «{title}»
        </Text>{" "}
        med unik ID{" "}
        <Text span fw={700}>
          {blid}
        </Text>{" "}
        er ikke blant bøkene {customer.name} har bestilt. Velg filial og frist for å dele den ut
        likevel.
      </Text>
      <Select
        label={"Filial"}
        placeholder={"Velg filial"}
        searchable
        allowDeselect={false}
        comboboxProps={comboboxProps}
        data={selectableBranches.map((branch) => ({ value: branch.id, label: branch.name }))}
        value={initialBranchId}
        onChange={(value) => {
          setBranchId(value);
          setDeadline(null);
        }}
      />
      <Select
        label={"Frist"}
        placeholder={"Velg frist"}
        allowDeselect={false}
        comboboxProps={comboboxProps}
        disabled={periods.length === 0}
        data={periods}
        value={selectedDeadline}
        onChange={setDeadline}
      />
      <Group justify={"flex-end"}>
        <Button variant={"default"} onClick={() => onClose(null)}>
          Avbryt
        </Button>
        <Button
          color={"green"}
          disabled={initialBranchId === null || selectedDeadline === null}
          onClick={() =>
            initialBranchId !== null &&
            selectedDeadline !== null &&
            onClose({ branchId: initialBranchId, deadline: selectedDeadline })
          }
        >
          Del ut
        </Button>
      </Group>
    </Stack>
  );
}

export default function NoOrderHandoutModal({
  request,
  customer,
  zIndex,
  onClose,
}: {
  request: { blid: string; title: string } | null;
  customer: UserDetail;
  zIndex: number;
  onClose: (choice: NoOrderChoice | null) => void;
}) {
  return (
    <Modal
      opened={request !== null}
      onClose={() => onClose(null)}
      title={"Del ut uten bestilling"}
      zIndex={zIndex}
    >
      {request && (
        <HandoutForm
          key={request.blid}
          blid={request.blid}
          title={request.title}
          customer={customer}
          zIndex={zIndex}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
