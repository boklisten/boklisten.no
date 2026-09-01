import { Table, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "react";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { GENERIC_ERROR_TEXT, PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { publicApi } from "@/shared/utils/publicApiClient";

function BuybackList() {
  const { data: items, error } = useQuery(publicApi.items.getBuybackItems.queryOptions());

  return (
    <>
      <Title>Innkjøpsliste</Title>
      <Text>
        Dette er listen over bøkene vi kjøper inn. Vær oppmerksom på at denne listen kan endre seg
        fortløpende. Vi tar forbehold for eventuelle feil i innkjøpslisten!
      </Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tittel</Table.Th>
            <Table.Th>ISBN</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Activity mode={!error ? "visible" : "hidden"}>
            {items?.map((item) => (
              <Table.Tr key={item.isbn}>
                <Table.Td>{item.title}</Table.Td>
                <Table.Td>{item.isbn}</Table.Td>
              </Table.Tr>
            ))}
          </Activity>
        </Table.Tbody>
      </Table>
      <Activity mode={!error && items && items.length === 0 ? "visible" : "hidden"}>
        <InfoAlert>Ingen bøker i listen. Kom tilbake senere for å se en oppdatert liste.</InfoAlert>
      </Activity>
      <Activity mode={error ? "visible" : "hidden"}>
        <ErrorAlert title={GENERIC_ERROR_TEXT}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
      </Activity>
    </>
  );
}

export default BuybackList;
