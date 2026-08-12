import type { PublicBlidLookupResult } from "@boklisten/backend/shared/public_blid_lookup";
import { ActionIcon, Card, Group, Stack, Table, Text, Title, Tooltip } from "@mantine/core";
import { IconMail, IconObjectScan, IconPhone } from "@tabler/icons-react";
import { useState } from "react";

import openScannerModal from "@/shared/components/scanner/openScannerModal";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";

export default function PublicBlidSearch() {
  const { client } = useApiClient();
  const [searchResult, setSearchResult] = useState<PublicBlidLookupResult | "inactive" | null>(
    null,
  );

  const form = useAppForm({
    defaultValues: {
      seach: "",
    },
  });

  async function onBlidSearch(blid: string) {
    setSearchResult(null);
    if (blid.length !== 8 && blid.length !== 12) {
      // Only lookup for valid blids
      return;
    }
    try {
      const [result] = await client.api.publicBlidLookup.lookup({ params: { blid } });
      if (result) {
        setSearchResult(result);
      } else {
        setSearchResult("inactive");
      }
    } catch (error) {
      console.error(error);
      setSearchResult("inactive");
    }
  }

  return (
    <>
      <form.AppField
        name={"seach"}
        listeners={{
          onChange: ({ value }) => onBlidSearch(value),
        }}
      >
        {(field) => (
          <field.TextField
            label={"Unik ID"}
            placeholder={"12345678"}
            rightSection={
              <Tooltip label={"Åpne scanner"}>
                <ActionIcon
                  variant={"subtle"}
                  onClick={() => {
                    openScannerModal({
                      title: "Skann unik ID",
                      accepts: ["blid"],
                      onScan: (blid) => {
                        field.setValue(blid);
                      },
                    });
                  }}
                >
                  <IconObjectScan />
                </ActionIcon>
              </Tooltip>
            }
          />
        )}
      </form.AppField>
      <Text c={"gray"} size={"sm"} ta={"center"}>
        {searchResult === "inactive" && "Denne boken er ikke registrert som utdelt."}
        {((searchResult === null &&
          form.state.values.seach.length !== 8 &&
          form.state.values.seach.length !== 12) ||
          form.state.values.seach.length === 0) &&
          "Venter på unik ID"}
      </Text>
      {searchResult !== "inactive" && searchResult !== null && (
        <>
          <Text size={"xl"} ta={"center"}>
            Denne boken tilhører
          </Text>
          <Card shadow="xl" withBorder>
            <Stack>
              <Title order={4} ta={"center"}>
                {searchResult.name}
              </Title>
              <Stack align={"center"} gap={"xs"}>
                <Group gap={5} justify={"center"}>
                  <IconPhone />
                  <Text>{searchResult.phone}</Text>
                </Group>
                <Group gap={5} justify={"center"}>
                  <IconMail />
                  <Text>{searchResult.email}</Text>
                </Group>
              </Stack>

              <Table verticalSpacing={"md"} ta={"left"} layout={"fixed"}>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Th>Tittel</Table.Th>
                    <Table.Td>{searchResult.title}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th>ISBN</Table.Th>
                    <Table.Td>{searchResult.isbn}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th>Utdelt hos</Table.Th>
                    <Table.Td>{searchResult.handoutBranch}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th>Utdelt den</Table.Th>
                    <Table.Td>
                      {norwegianTime(searchResult.handoutTime).format("DD/MM/YYYY")}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th>Frist</Table.Th>
                    <Table.Td>{norwegianTime(searchResult.deadline).format("DD/MM/YYYY")}</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>
        </>
      )}
    </>
  );
}
