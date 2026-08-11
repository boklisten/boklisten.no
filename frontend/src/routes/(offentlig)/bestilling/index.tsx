import { Container, Stack, Title } from "@mantine/core";
import SelectOrderBranch from "@/features/order/SelectOrderBranch";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";
import { queryOptions } from "@tanstack/react-query";
import { publicApi } from "@/shared/utils/publicApiClient";

export const Route = createFileRoute("/(offentlig)/bestilling/")({
  head: () =>
    seo({
      title: "Bestill bøker | Boklisten.no",
      description:
        "Velg hvilken skole og hvilke fag du tar, så finner vi bøkene du trenger for deg!",
    }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      queryOptions(publicApi.branches.getPublic.queryOptions()),
    );
  },
  component: OrderPage,
});

function OrderPage() {
  return (
    <Container size={"md"}>
      <Stack gap={"xs"}>
        <Title>Hvor går du på skole?</Title>
        <SelectOrderBranch />
      </Stack>
    </Container>
  );
}
