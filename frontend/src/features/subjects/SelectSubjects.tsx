// useSet does not support React Compiler yet
"use no memo";

import { Affix, Box, Button, Card, Skeleton, Stack, Text } from "@mantine/core";
import { useSet } from "@mantine/hooks";
import { IconArrowBack, IconBasket, IconBasketCheck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Activity } from "react";

import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useCart from "@/shared/hooks/useCart";
import { publicApi } from "@/shared/utils/publicApiClient";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

export default function SelectSubjects({ branchId }: { branchId: string }) {
  const navigate = useNavigate();
  const cart = useCart();
  const selectedSubjects = useSet<string>();
  const { data: subjects } = useQuery(
    publicApi.subjects.getBranchSubjects.queryOptions({ params: { branchId } }),
  );

  if (!subjects) {
    return (
      <Stack>
        <Skeleton h={35} w={"100%"} />
        <Skeleton h={35} w={"100%"} />
        <Skeleton h={35} w={"100%"} />
        <Skeleton h={35} w={"100%"} />
        <Skeleton h={35} w={"100%"} />
        <Skeleton h={35} w={"100%"} />
        <Skeleton h={35} w={"100%"} />
        <Skeleton h={35} w={"100%"} />
        <Skeleton h={35} w={"100%"} />
        <Skeleton h={35} w={"100%"} />
        <Skeleton h={35} w={"100%"} />
        <Skeleton h={35} w={"100%"} />
      </Stack>
    );
  }

  return (
    <>
      <Activity mode={Object.entries(subjects).length === 0 ? "visible" : "hidden"}>
        <InfoAlert title={"Ingen fag tilgjengelig"}>
          Denne skolen har ikke satt opp noen fag enda. Ta kontakt på info@boklisten.no om du har
          spørsmål.
        </InfoAlert>
        <Button component={TanStackAnchor} to={"/bestilling"} leftSection={<IconArrowBack />}>
          Velg en annen skole
        </Button>
      </Activity>
      {Object.entries(subjects)
        .toSorted((a, b) => a[0].localeCompare(b[0]))
        .map(([name]) => (
          <Button
            leftSection={selectedSubjects.has(name) ? <IconBasketCheck /> : undefined}
            bg={selectedSubjects.has(name) ? "green" : ""}
            key={name}
            onClick={() => {
              if (selectedSubjects.has(name)) {
                selectedSubjects.delete(name);
              } else {
                selectedSubjects.add(name);
              }
            }}
          >
            {name}
          </Button>
        ))}
      <Activity mode={selectedSubjects.size > 0 ? "visible" : "hidden"}>
        <Affix w={"100%"}>
          <Card withBorder shadow={"md"}>
            <Stack align={"center"} gap={"xs"}>
              <Text fs={"italic"}>{selectedSubjects.size} fag</Text>
              <Box>
                <Button
                  onClick={() => {
                    cart.clear();
                    for (const subject of selectedSubjects) {
                      const cartItems = subjects[subject] ?? [];
                      for (const cartItem of cartItems) {
                        cart.add(cartItem);
                      }
                    }
                    selectedSubjects.clear();
                    void navigate({ to: "/handlekurv" });
                  }}
                  leftSection={<IconBasket />}
                  bg={"green"}
                  c={"white"}
                  fw={"bolder"}
                >
                  Generer boklisten din
                </Button>
              </Box>
            </Stack>
          </Card>
        </Affix>
      </Activity>
    </>
  );
}
