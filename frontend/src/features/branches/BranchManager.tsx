import type { Branch } from "@boklisten/backend/shared/branch";
import { Button, Grid, Group, Stack, Tabs, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconBook2,
  IconBuildingStore,
  IconCashRegister,
  IconChartAreaLine,
  IconClock,
  IconHeartHandshake,
  IconPlus,
  IconSchool,
  IconShoppingCart,
  IconSignature,
  IconUserCog,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";

import ActiveBooksTab from "@/features/branches/branch-books/ActiveBooksTab";
import BranchInsightsTab from "@/features/branches/insights/BranchInsightsTab";
import OrderedBooksTab from "@/features/branches/branch-books/OrderedBooksTab";
import BranchGeneralSettings from "@/features/branches/BranchGeneralSettings";
import BranchPaymentSettings from "@/features/branches/BranchPaymentSettings";
import BranchSignatureStatus from "@/features/branches/BranchSignatureStatus";
import OpeningHoursSettings from "@/features/branches/opening_hours/OpeningHoursSettings";
import BranchSubjectSettings from "@/features/branches/subjects/BranchSubjectSettings";
import BranchRounds from "@/features/matches/rounds/BranchRounds";
import BranchUsersTab from "@/features/branches/BranchUsersTab";
import UploadSubjectChoices from "@/features/branches/UploadSubjectChoices";
import EmployeesTab from "@/features/user-management/EmployeesTab";
import { parseBranchManagerTab } from "@/features/branches/branchManagerTabs";
import type { BranchManagerTab } from "@/features/branches/branchManagerTabs";
import SignatureGallery from "@/features/signatures/SignatureGallery";
import SelectBranchTreeView from "@/shared/components/SelectBranchTreeView";
import useAuth from "@/shared/hooks/useAuth";
import { api } from "@/shared/utils/apiClient";
import { isRootBranch } from "@/shared/utils/branchTree";

const route = getRouteApi("/(administrasjon)/admin/filialer");

/**
 * Neuter nouns a branch may be divided into, matched as the last part of the label so compounds
 * ("studiested", "klassetrinn", "utdanningsprogram") take "nytt" too; everything else is "ny".
 */
const NEUTER_CHILD_LABELS = [
  "selskap",
  "årskull",
  "kull",
  "sted",
  "trinn",
  "nivå",
  "program",
  "kurs",
  "område",
  "fag",
];

/**
 * The settings that only make sense on a place: the root is a scope, "everyone", and inherits
 * nothing, so it keeps the general tab alone.
 */
const PLACE_SETTINGS_TABS: ReadonlySet<BranchManagerTab> = new Set([
  "payment",
  "subjects",
  "hours",
]);

/** What the create action is called on a node: "Ny skole", "Nytt selskap", else "Ny filial". */
function newChildLabel(childLabel: string | null): string {
  const noun = childLabel?.trim().toLowerCase();
  if (!noun) {
    return "Ny filial";
  }
  const neuter = NEUTER_CHILD_LABELS.some((ending) => noun.endsWith(ending));
  return `${neuter ? "Nytt" : "Ny"} ${noun}`;
}

export default function BranchManager() {
  const { data: branches } = useQuery(api.branches.index.queryOptions());
  const { user } = useAuth();

  const { filial, filialFane } = route.useSearch();
  const navigate = route.useNavigate();
  const setSelectedBranchId = (branchId: string | null) =>
    void navigate({
      search: (previous) => ({ ...previous, filial: branchId ?? undefined }),
      replace: true,
    });
  // The page opens on the viewer's home node, and a `filial` the viewer may not work on (a link
  // from someone with a wider slice, a stale bookmark) falls back to it.
  const homeBranch = branches?.find((branch) => branch.id === user?.employeeBranchId);
  const selectedBranch =
    branches?.find((branch) => branch.id === filial && branch.selectable) ?? homeBranch;
  const selectedBranchId = selectedBranch?.id ?? null;
  const isRoot = selectedBranch !== undefined && isRootBranch(selectedBranch);
  // A place-settings tab on the root falls back to the one settings tab the root has.
  const activeTab =
    filialFane === undefined || (isRoot && PLACE_SETTINGS_TABS.has(filialFane))
      ? "general"
      : filialFane;

  const createBranchModalId = "create-branch-modal";
  const openCreateModal = (parent: Branch) =>
    modals.open({
      modalId: createBranchModalId,
      title: newChildLabel(parent.childLabel),
      children: (
        <BranchGeneralSettings
          parentBranch={parent}
          onSuccess={(newBranch) => {
            if (newBranch) {
              setSelectedBranchId(newBranch.id);
            }
            modals.close(createBranchModalId);
          }}
        />
      ),
    });
  return (
    <Stack>
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <SelectBranchTreeView
            label="Velg filial"
            branches={branches ?? []}
            selectedBranchId={selectedBranchId}
            onSelect={(branchId) => {
              setSelectedBranchId(branchId);
            }}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 9 }}>
          {selectedBranch && (
            <Stack>
              <Group justify="space-between" align="center" wrap="wrap">
                <Title>{selectedBranch.name}</Title>
                <Button
                  variant="light"
                  leftSection={<IconPlus size={18} />}
                  onClick={() => openCreateModal(selectedBranch)}
                >
                  {newChildLabel(selectedBranch.childLabel)}
                </Button>
              </Group>
              <Tabs
                value={activeTab}
                onChange={(value) =>
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      filialFane: parseBranchManagerTab(value),
                    }),
                    replace: true,
                  })
                }
                keepMounted={false}
              >
                <Tabs.List mb="md">
                  <Tabs.Tab value="general" leftSection={<IconBuildingStore />}>
                    Generelt
                  </Tabs.Tab>
                  {!isRoot && (
                    <>
                      <Tabs.Tab value="payment" leftSection={<IconCashRegister />}>
                        Betaling
                      </Tabs.Tab>
                      <Tabs.Tab value="subjects" leftSection={<IconSchool />}>
                        Fag
                      </Tabs.Tab>
                      <Tabs.Tab value="hours" leftSection={<IconClock />}>
                        Åpningstider
                      </Tabs.Tab>
                    </>
                  )}
                  <Tabs.Tab value="users" leftSection={<IconUsers />}>
                    Brukere
                  </Tabs.Tab>
                  <Tabs.Tab value="employees" leftSection={<IconUserCog />}>
                    Ansatte
                  </Tabs.Tab>
                  <Tabs.Tab value="signatures" leftSection={<IconSignature />}>
                    Signering
                  </Tabs.Tab>
                  <Tabs.Tab value="active-books" leftSection={<IconBook2 />}>
                    Aktive bøker
                  </Tabs.Tab>
                  <Tabs.Tab value="ordered-books" leftSection={<IconShoppingCart />}>
                    Bestilte bøker
                  </Tabs.Tab>
                  <Tabs.Tab value="insights" leftSection={<IconChartAreaLine />}>
                    Innsikt
                  </Tabs.Tab>
                  <Tabs.Tab value="rounds" leftSection={<IconHeartHandshake />}>
                    Overleveringer
                  </Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="general">
                  <BranchGeneralSettings key={selectedBranchId} existingBranch={selectedBranch} />
                </Tabs.Panel>
                <Tabs.Panel value="payment">
                  <BranchPaymentSettings key={selectedBranchId} existingBranch={selectedBranch} />
                </Tabs.Panel>
                <Tabs.Panel value="subjects">
                  <BranchSubjectSettings key={selectedBranchId} branchId={selectedBranch.id} />
                </Tabs.Panel>
                <Tabs.Panel value="hours">
                  <OpeningHoursSettings key={selectedBranchId} branchId={selectedBranch.id} />
                </Tabs.Panel>
                <Tabs.Panel value="users">
                  <BranchUsersTab
                    key={selectedBranch.id}
                    branchId={selectedBranch.id}
                    isRoot={isRoot}
                  />
                </Tabs.Panel>
                <Tabs.Panel value="employees">
                  <EmployeesTab
                    key={selectedBranch.id}
                    branchId={selectedBranch.id}
                    isRoot={isRoot}
                  />
                </Tabs.Panel>
                <Tabs.Panel value="signatures">
                  <Stack key={selectedBranch.id} gap="xl">
                    <BranchSignatureStatus branchId={selectedBranch.id} />
                    <SignatureGallery branchId={selectedBranch.id} />
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel value="active-books">
                  <ActiveBooksTab key={selectedBranch.id} branchId={selectedBranch.id} />
                </Tabs.Panel>
                <Tabs.Panel value="ordered-books">
                  <Stack key={selectedBranch.id}>
                    <OrderedBooksTab branchId={selectedBranch.id} />
                    <UploadSubjectChoices
                      branchId={selectedBranch.id}
                      branchName={selectedBranch.name}
                    />
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel value="insights">
                  <BranchInsightsTab key={selectedBranch.id} branchId={selectedBranch.id} />
                </Tabs.Panel>
                <Tabs.Panel value="rounds">
                  <BranchRounds key={selectedBranch.id} branchId={selectedBranch.id} />
                </Tabs.Panel>
              </Tabs>
            </Stack>
          )}
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
