import { Skeleton, Stack, Table } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import ContactInfo from "@/shared/components/ContactInfo";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { formatOpeningHour } from "@/shared/utils/dates";
import { publicApi } from "@/shared/utils/publicApiClient";
import { Route } from "@tuyau/core/types";

const OpeningHourRow = ({
  openingHour,
}: {
  openingHour: Route.Response<"opening_hours.get">[number];
}) => {
  const { weekday, date, fromTime, toTime } = formatOpeningHour(openingHour);
  return (
    <Table.Tr key={openingHour.id}>
      <Table.Td>
        {weekday} {date}
      </Table.Td>
      <Table.Td>{fromTime}</Table.Td>
      <Table.Td>{toTime}</Table.Td>
    </Table.Tr>
  );
};

export default function BranchOpeningHours({ branchId }: { branchId: string }) {
  const {
    data: openingHours,
    isLoading: isLoadingOpeningHours,
    isError: isErrorOpeningHours,
  } = useQuery(publicApi.openingHours.get.queryOptions({ params: { branchId } }));

  if (isLoadingOpeningHours) {
    return (
      <Stack w={"100%"} mt={"md"}>
        <Skeleton height={25} />
        <Skeleton height={25} />
        <Skeleton height={25} />
        <Skeleton height={25} />
        <Skeleton height={25} />
      </Stack>
    );
  }

  if (isErrorOpeningHours || openingHours == undefined) {
    return (
      <ErrorAlert title={"Klarte ikke laste inn åpningstider"}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }

  if (openingHours.length === 0) {
    return (
      <>
        <InfoAlert title={"Sesongen er over – eller åpningstidene er ikke klare enda"}>
          Du kan bestille bøker i Posten, eller kontakte oss for spørsmål.
        </InfoAlert>
        <ContactInfo />
      </>
    );
  }

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Dato</Table.Th>
          <Table.Th>Fra</Table.Th>
          <Table.Th>Til</Table.Th>
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
