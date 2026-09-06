import { Group, Stack, Tabs, Text, Title } from "@mantine/core";
import { IconBuildingBank, IconFileInvoice, IconUsersGroup } from "@tabler/icons-react";
import { getRouteApi } from "@tanstack/react-router";

import LegacyAppLink from "@/features/auth-linker/LegacyAppLink";
import CompanyInvoiceTab from "@/features/invoices/CompanyInvoiceTab";
import GenerateInvoicesTab from "@/features/invoices/GenerateInvoicesTab";
import InvoiceOverview from "@/features/invoices/InvoiceOverview";
import { parseInvoiceTab } from "@/features/invoices/invoiceParams";

const route = getRouteApi("/(administrasjon)/admin/faktura");

export default function InvoiceManager() {
  const { fakturaFane } = route.useSearch();
  const navigate = route.useNavigate();

  return (
    <Stack>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={4}>
          <Title>Faktura</Title>
          <Text c="dimmed">Opprett, se og eksporter fakturaer</Text>
        </Stack>
        <LegacyAppLink path="invoices" label="Gå til gammelt faktura-system" />
      </Group>
      <Tabs
        value={fakturaFane ?? "oversikt"}
        onChange={(value) =>
          void navigate({
            search: (previous) => ({
              ...previous,
              fakturaFane:
                parseInvoiceTab(value) === "oversikt" ? undefined : parseInvoiceTab(value),
              faktura: undefined,
            }),
            replace: true,
          })
        }
        keepMounted={false}
      >
        <Tabs.List mb="md">
          <Tabs.Tab value="oversikt" leftSection={<IconFileInvoice size={18} />}>
            Oversikt
          </Tabs.Tab>
          <Tabs.Tab value="elevfakturaer" leftSection={<IconUsersGroup size={18} />}>
            Lag elevfakturaer
          </Tabs.Tab>
          <Tabs.Tab value="selskapsfaktura" leftSection={<IconBuildingBank size={18} />}>
            Lag selskapsfaktura
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="oversikt">
          <InvoiceOverview />
        </Tabs.Panel>
        <Tabs.Panel value="elevfakturaer">
          <GenerateInvoicesTab />
        </Tabs.Panel>
        <Tabs.Panel value="selskapsfaktura">
          <CompanyInvoiceTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
