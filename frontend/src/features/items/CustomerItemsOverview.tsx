import { Accordion, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "react";
import type { ReactNode } from "react";

import CustomerItemCard from "@/features/items/CustomerItemCard";
import OpenOrdersList from "@/features/items/OpenOrdersList";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

function CustomerItemsOverviewWrapper({
  orderedItemsSlot,
  activeItemsSlot,
  inactiveItemsSlot,
}: {
  orderedItemsSlot: ReactNode;
  activeItemsSlot: ReactNode;
  inactiveItemsSlot: ReactNode;
}) {
  return (
    <>
      <Stack gap="xs">
        <Title order={2} mt="md">
          Bestilte bøker
        </Title>
        {orderedItemsSlot}
      </Stack>

      <Stack gap="xs">
        <Title order={2}>Aktive bøker</Title>
        <Text fw="light" fs="italic">
          Dette er bøkene du for øyeblikket er ansvarlig for. Du får beskjed om hvordan de skal
          leveres når fristen nærmer seg.
        </Text>
        {activeItemsSlot}
      </Stack>

      <Accordion>
        <Accordion.Item value="prev-items">
          <Accordion.Control>
            <Title order={2}>Tidligere bøker</Title>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack>{inactiveItemsSlot}</Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </>
  );
}

export default function CustomerItemsOverview() {
  const { api } = useApiClient();

  const { data, isLoading, isError } = useQuery(api.customerItems.getCustomerItems.queryOptions());

  const {
    data: openOrderItems,
    isLoading: isLoadingOpenOrderItems,
    isError: isErrorOpenOrderItems,
  } = useQuery(api.orders.getOpenOrders.queryOptions());

  if (isLoading || isLoadingOpenOrderItems) {
    return (
      <CustomerItemsOverviewWrapper
        orderedItemsSlot={
          <>
            <Skeleton height={50} />
            <Skeleton height={50} width={150} />
          </>
        }
        activeItemsSlot={
          <>
            <Skeleton height={250} />
            <Skeleton height={250} />
            <Skeleton height={250} />
          </>
        }
        inactiveItemsSlot={
          <>
            <Skeleton height={250} />
            <Skeleton height={250} />
            <Skeleton height={250} />
          </>
        }
      />
    );
  }

  if (!data || isError || !openOrderItems || isErrorOpenOrderItems) {
    return (
      <ErrorAlert title="Dette skjedde noe galt under innlastingen av dine bøker">
        {PLEASE_TRY_AGAIN_TEXT}
      </ErrorAlert>
    );
  }

  const inactiveItems = data.filter((ci) => ["returned", "buyout"].includes(ci.status.type));
  const activeItems = data.filter((ci) => ["active", "overdue"].includes(ci.status.type));

  return (
    <CustomerItemsOverviewWrapper
      orderedItemsSlot={<OpenOrdersList openOrderItems={openOrderItems} />}
      activeItemsSlot={
        <>
          <Activity mode={activeItems.length > 0 ? "visible" : "hidden"}>
            {activeItems.map((actionableCustomerItem) => (
              <CustomerItemCard
                key={actionableCustomerItem.id}
                actionableCustomerItem={actionableCustomerItem}
              />
            ))}
          </Activity>
          <Activity mode={activeItems.length === 0 ? "visible" : "hidden"}>
            <InfoAlert title="Du har for øyeblikket ingen aktive bøker." />
          </Activity>
        </>
      }
      inactiveItemsSlot={
        <>
          <Activity mode={inactiveItems.length > 0 ? "visible" : "hidden"}>
            {inactiveItems.map((actionableCustomerItem) => (
              <CustomerItemCard
                key={actionableCustomerItem.id}
                actionableCustomerItem={actionableCustomerItem}
              />
            ))}
          </Activity>
          <Activity mode={inactiveItems.length === 0 ? "visible" : "hidden"}>
            <InfoAlert title="Du har ikke levert inn eller kjøpt ut noen bøker enda." />
          </Activity>
        </>
      }
    />
  );
}
