import { Container } from "@mantine/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { childrenOf, nodeById } from "@/features/branch-walk/branchTree";
import BranchWalkStep from "@/features/branch-walk/BranchWalkStep";
import { ORDER_WALK, orderTreeOptions } from "@/features/order/orderTree";
import SubjectStep from "@/features/order/SubjectStep";
import { api } from "@/shared/utils/apiClient";
import { seo } from "@/shared/utils/seo";

/**
 * One step of the order flow, whatever the depth: the branches under this one, or its subjects
 * once the walk reaches a branch with books. The tree alone decides which.
 */
export const Route = createFileRoute("/(offentlig)/bestilling/$branchId")({
  head: () =>
    seo({
      title: "Bestill bøker | Boklisten.no",
      description:
        "Velg fagene du tar, så finner vi pensumbøkene som hører til. Du henter bøkene på stand ved skolen din, eller får dem tilsendt i posten.",
    }),
  loader: async ({ context, params }) => {
    const tree = await context.queryClient.query(orderTreeOptions());
    const branch = nodeById(tree, params.branchId);
    // A branch that is not (or no longer) a step: start over at the top.
    if (!branch) {
      throw redirect({ to: "/bestilling", replace: true });
    }
    if (branch.isLeaf) {
      await context.queryClient.query(
        api.branchCatalog.show.queryOptions({ params: { branchId: branch.id } }),
      );
      return;
    }
    const children = childrenOf(tree, branch.id);
    // A level with one choice is no choice; go straight through it.
    if (children.length === 1 && children[0]) {
      throw redirect({
        to: "/bestilling/$branchId",
        params: { branchId: children[0].id },
        replace: true,
      });
    }
  },
  component: OrderStepPage,
});

function OrderStepPage() {
  const { branchId } = Route.useParams();
  const { data: tree } = useSuspenseQuery(orderTreeOptions());
  const branch = nodeById(tree, branchId);
  if (!branch) {
    return null;
  }
  return (
    <Container size="md">
      {branch.isLeaf ? (
        <SubjectStep tree={tree} branch={branch} />
      ) : (
        <BranchWalkStep walk={ORDER_WALK} tree={tree} parent={branch} />
      )}
    </Container>
  );
}
