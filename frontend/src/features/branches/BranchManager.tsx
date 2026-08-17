import { Box, Button, Divider, Grid, Stack, Tabs, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconBook2,
  IconBooks,
  IconBuildingStore,
  IconCashRegister,
  IconClock,
  IconHierarchy3,
  IconPlus,
  IconShoppingCart,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import ActiveBooksTab from "@/features/branches/branch-books/ActiveBooksTab";
import OrderedBooksTab from "@/features/branches/branch-books/OrderedBooksTab";
import BranchGeneralSettings from "@/features/branches/BranchGeneralSettings";
import BranchItemSettings from "@/features/branches/BranchItemSettings";
import BranchMembers from "@/features/branches/BranchMembers";
import BranchPaymentSettings from "@/features/branches/BranchPaymentSettings";
import BranchRelationshipSettings from "@/features/branches/BranchRelationshipSettings";
import OpeningHoursSettings from "@/features/branches/opening_hours/OpeningHoursSettings";
import UploadBranchUsers from "@/features/branches/UploadBranchUsers";
import UploadSubjectChoices from "@/features/branches/UploadSubjectChoices";
import SelectBranchTreeView from "@/shared/components/SelectBranchTreeView";
import useApiClient from "@/shared/hooks/useApiClient";

export default function BranchManager() {
  const { api } = useApiClient();
  const { data: branches } = useQuery(api.branches.getAll.queryOptions());

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const selectedBranch = branches?.find((branch) => branch.id === selectedBranchId);

  const createBranchModalId = "create-branch-modal";
  return (
    <Stack>
      <Box>
        <Button
          leftSection={<IconPlus />}
          onClick={() =>
            modals.open({
              modalId: createBranchModalId,
              title: "Opprett filial",
              children: (
                <BranchGeneralSettings
                  onSuccess={(newBranch) => {
                    if (newBranch) {
                      setSelectedBranchId(newBranch?.id ?? null);
                    }
                    modals.close(createBranchModalId);
                  }}
                />
              ),
            })
          }
        >
          Opprett filial
        </Button>
      </Box>
      <Divider />
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <SelectBranchTreeView
            label={"Velg filial"}
            branches={branches ?? []}
            onSelect={(branchId) => {
              setSelectedBranchId(branchId);
            }}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 9 }}>
          {selectedBranch && (
            <Stack>
              <Title>{selectedBranch.name}</Title>
              <Tabs defaultValue={"general"}>
                <Tabs.List mb={"md"}>
                  <Tabs.Tab value={"general"} leftSection={<IconBuildingStore />}>
                    Generelt
                  </Tabs.Tab>
                  <Tabs.Tab value={"relationships"} leftSection={<IconHierarchy3 />}>
                    Relasjoner
                  </Tabs.Tab>
                  <Tabs.Tab value={"payment"} leftSection={<IconCashRegister />}>
                    Betaling
                  </Tabs.Tab>
                  <Tabs.Tab value={"books"} leftSection={<IconBooks />}>
                    Bøker
                  </Tabs.Tab>
                  <Tabs.Tab value={"hours"} leftSection={<IconClock />}>
                    Åpningstider
                  </Tabs.Tab>
                  <Tabs.Tab value={"members"} leftSection={<IconUsers />}>
                    Elever
                  </Tabs.Tab>
                  <Tabs.Tab value={"active-books"} leftSection={<IconBook2 />}>
                    Aktive bøker
                  </Tabs.Tab>
                  <Tabs.Tab value={"ordered-books"} leftSection={<IconShoppingCart />}>
                    Bestilte bøker
                  </Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value={"general"}>
                  <BranchGeneralSettings key={selectedBranchId} existingBranch={selectedBranch} />
                </Tabs.Panel>
                <Tabs.Panel value={"relationships"}>
                  <BranchRelationshipSettings key={selectedBranchId} branch={selectedBranch} />
                </Tabs.Panel>
                <Tabs.Panel value={"payment"}>
                  <BranchPaymentSettings key={selectedBranchId} existingBranch={selectedBranch} />
                </Tabs.Panel>
                <Tabs.Panel value={"books"}>
                  <BranchItemSettings key={selectedBranchId} branchId={selectedBranch.id} />
                </Tabs.Panel>
                <Tabs.Panel value={"hours"}>
                  <OpeningHoursSettings key={selectedBranchId} branchId={selectedBranch.id} />
                </Tabs.Panel>
                <Tabs.Panel value={"members"}>
                  <Stack>
                    <BranchMembers key={selectedBranch.id} branchId={selectedBranch.id} />
                    <UploadBranchUsers branchId={selectedBranch.id} />
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel value={"active-books"}>
                  <ActiveBooksTab key={selectedBranch.id} branchId={selectedBranch.id} />
                </Tabs.Panel>
                <Tabs.Panel value={"ordered-books"}>
                  <Stack>
                    <OrderedBooksTab key={selectedBranch.id} branchId={selectedBranch.id} />
                    <UploadSubjectChoices
                      key={selectedBranch.id}
                      branchId={selectedBranch.id}
                      branchName={selectedBranch.name}
                    />
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </Stack>
          )}
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
