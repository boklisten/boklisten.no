import { Button, Skeleton, Stack, Table } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { formatOpeningHour } from "@/shared/utils/dates";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import { publicApi } from "@/shared/utils/publicApiClient";
import type { Route } from "@tuyau/core/types";

function OpeningHourRow({
  openingHour,
}: {
  openingHour: Route.Response<"opening_hours.get">[number];
}) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const deleteOpeningHourMutation = useMutation(
    api.openingHours.delete.mutationOptions({
      onError: () => showErrorNotification("Klarte ikke slette åpningstid"),
      onSuccess: () => {
        showSuccessNotification("Åpningstid ble slettet!");
      },
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.openingHours.get.queryKey({ params: { branchId: openingHour.branchId } }),
        }),
    }),
  );
  const { weekday, date, fromTime, toTime } = formatOpeningHour(openingHour);
  return (
    <Table.Tr key={openingHour.id}>
      <Table.Td>
        {weekday} {date}
      </Table.Td>
      <Table.Td>{fromTime}</Table.Td>
      <Table.Td>{toTime}</Table.Td>
      <Table.Td>
        <Button
          bg="red"
          onClick={() =>
            deleteOpeningHourMutation.mutate({
              params: {
                id: openingHour.id,
              },
            })
          }
        >
          Slett
        </Button>
      </Table.Td>
    </Table.Tr>
  );
}

export default function OpeningHoursList({ branchId }: { branchId: string }) {
  const {
    data: openingHours,
    isLoading: isLoadingOpeningHours,
    isError: isErrorOpeningHours,
  } = useQuery(publicApi.openingHours.get.queryOptions({ params: { branchId } }));

  if (isLoadingOpeningHours) {
    return (
      <Stack w="100%" mt="md">
        <Skeleton height={25} />
        <Skeleton height={25} />
        <Skeleton height={25} />
        <Skeleton height={25} />
        <Skeleton height={25} />
      </Stack>
    );
  }

  if (isErrorOpeningHours || openingHours === undefined) {
    return (
      <ErrorAlert title="Klarte ikke laste inn åpningstider">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }

  if (openingHours.length === 0) {
    return (
      <InfoAlert title="Ingen fremtidige åpningstider">
        Denne filialen har ingen fremtidige åpningstider.
      </InfoAlert>
    );
  }

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Dato</Table.Th>
          <Table.Th>Fra</Table.Th>
          <Table.Th>Til</Table.Th>
          <Table.Th>Handling</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {openingHours.map((openingHour) => (
          <OpeningHourRow key={openingHour.id} openingHour={openingHour} />
        ))}
      </Table.Tbody>
    </Table>
  );
}
