import { Container } from "@mantine/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { childrenOf } from "@/features/branch-walk/branchTree";
import BranchWalkStep from "@/features/branch-walk/BranchWalkStep";
import { ORDER_WALK, orderTreeOptions } from "@/features/order/orderTree";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/bestilling/")({
  head: () =>
    seo({
      title: "Bestill bøker | Boklisten.no",
      description: "Velg skolen din og fagene du tar, så finner vi bøkene du trenger.",
    }),
  loader: async ({ context }) => {
    const tree = await context.queryClient.query(orderTreeOptions());
    const top = childrenOf(tree, null);
    // A single way in is no choice; go straight to it.
    if (top.length === 1 && top[0]) {
      throw redirect({
        to: "/bestilling/$branchId",
        params: { branchId: top[0].id },
        replace: true,
      });
    }
  },
  component: OrderPage,
});

function OrderPage() {
  const { data: tree } = useSuspenseQuery(orderTreeOptions());
  return (
    <Container size="md">
      <BranchWalkStep walk={ORDER_WALK} tree={tree} parent={null} />
    </Container>
  );
}
