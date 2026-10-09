import { Container } from "@mantine/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { childrenOf, nodeById, shortName, stepLabel } from "@/features/branch-walk/branchTree";
import BranchWalkStep from "@/features/branch-walk/BranchWalkStep";
import { ORDER_WALK, orderTreeOptions } from "@/features/order/orderTree";
import SubjectStep from "@/features/order/SubjectStep";
import { api } from "@/shared/utils/apiClient";
import { seo } from "@/shared/utils/seo";

/**
 * One step of the order flow, whatever the depth: the branches under this one, or its subjects
 * once the walk reaches a branch with books. The tree alone decides which.
 */
const listFormat = new Intl.ListFormat("nb", { type: "conjunction" });

/** A few names, and how many more there are, for a description that fits a search result. */
function someOf(names: string[], shown = 3): string {
  return names.length > shown + 1
    ? `${names.slice(0, shown).join(", ")} og ${names.length - shown} andre`
    : listFormat.format(names);
}

/**
 * Each step is a page of its own in search results, so a privatist searching for their school's
 * books lands on its subjects: the title names the branch, the description what is found there.
 */
export const Route = createFileRoute("/(offentlig)/bestilling/$branchId")({
  head: ({ loaderData }) =>
    seo(
      loaderData ?? {
        title: "Bestill bøker | Boklisten.no",
        description: "Velg fagene du tar, så finner vi pensumbøkene som hører til.",
      },
    ),
  loader: async ({ context, params }) => {
    const tree = await context.queryClient.query(orderTreeOptions());
    const branch = nodeById(tree, params.branchId);
    // A branch that is not (or no longer) a step: start over at the top.
    if (!branch) {
      throw redirect({ to: "/bestilling", replace: true });
    }
    if (branch.isLeaf) {
      const catalog = await context.queryClient.query(
        api.branchCatalog.show.queryOptions({ params: { branchId: branch.id } }),
      );
      const subjects = Object.keys(catalog).toSorted((a, b) => a.localeCompare(b, "nb"));
      return {
        title: `Pensumbøker for ${branch.name} | Boklisten.no`,
        description:
          subjects.length > 0
            ? `Bestill pensumbøkene for ${branch.name}. Velg fagene du tar, så finner vi bøkene som hører til. Fag: ${someOf(subjects)}.`
            : `Bestill pensumbøkene for ${branch.name} hos Boklisten.`,
      };
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
    return {
      title: `Bestill bøker – ${branch.name} | Boklisten.no`,
      description: `Finn pensumbøkene for ${branch.name}. Velg ${stepLabel(tree, branch)}: ${someOf(children.map(shortName), 5)}.`,
    };
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
