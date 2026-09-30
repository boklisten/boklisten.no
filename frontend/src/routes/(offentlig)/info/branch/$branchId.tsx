import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { childrenOf, nodeById, pathTo } from "@/features/branch-walk/branchTree";
import BranchWalkStep from "@/features/branch-walk/BranchWalkStep";
import BranchOpeningHours from "@/features/info/BranchOpeningHoursInfo";
import { OPENING_HOURS_WALK, openingHoursTreeOptions } from "@/features/info/openingHoursWalk";
import { api } from "@/shared/utils/apiClient";
import { jsonLdScript, seo } from "@/shared/utils/seo";
import { branchSchema } from "@/shared/utils/structuredData";

/**
 * One step of the opening-hours walk, whatever the depth: the branches under this one, or the
 * hours themselves once the walk reaches a branch with a stand ahead. A branch off the walk
 * (linked to directly, its season over) still gets its own page, with the notice instead of hours.
 */
export const Route = createFileRoute("/(offentlig)/info/branch/$branchId")({
  loader: async ({ context, params }) => {
    const tree = await context.queryClient.query(openingHoursTreeOptions());
    const node = nodeById(tree, params.branchId);
    if (node && !node.isLeaf) {
      const children = childrenOf(tree, node.id);
      // A level with one choice is no choice; go straight through it.
      if (children.length === 1 && children[0]) {
        throw redirect({
          to: "/info/branch/$branchId",
          params: { branchId: children[0].id },
          replace: true,
        });
      }
      return { branch: null, openingHours: [] };
    }
    const [branch, openingHours] = await Promise.all([
      context.queryClient.query({
        ...api.branches.show.queryOptions({ params: { branchId: params.branchId } }),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...api.openingHours.index.queryOptions({ params: { branchId: params.branchId } }),
        staleTime: "static",
      }),
    ]);
    // A branch nobody may see, or none at all: start over at the top.
    if (!branch) {
      throw redirect({ to: "/info/branch", replace: true });
    }
    return { branch, openingHours };
  },
  head: ({ loaderData, params }) => {
    const branchName = loaderData?.branch?.name;
    if (!branchName) {
      return seo({
        title: "Skoler og åpningstider | Boklisten.no",
        description: "Skal du hente eller levere bøker? Finn ut når vi står på stand på din skole.",
      });
    }

    const openingHours = loaderData?.openingHours ?? [];
    return {
      ...seo({
        title: `${branchName} – åpningstider | Boklisten.no`,
        description:
          openingHours.length > 0
            ? `Se når Boklisten står på stand ved ${branchName}, og når du kan hente og levere pensumbøker.`
            : `Åpningstider for henting og levering av pensumbøker ved ${branchName}.`,
      }),
      scripts: [
        jsonLdScript(
          branchSchema({
            branchName,
            address: loaderData?.branch?.address ?? undefined,
            pathname: `/info/branch/${params.branchId}`,
            openingHours,
          }),
        ),
      ],
    };
  },
  component: OpeningHoursStepPage,
});

function OpeningHoursStepPage() {
  const { branchId } = Route.useParams();
  const { branch } = Route.useLoaderData();
  const { data: tree } = useSuspenseQuery(openingHoursTreeOptions());
  const node = nodeById(tree, branchId);
  if (branch) {
    return <BranchOpeningHours branch={branch} path={node ? pathTo(tree, node) : []} />;
  }
  if (!node) {
    return null;
  }
  return <BranchWalkStep walk={OPENING_HOURS_WALK} tree={tree} parent={node} />;
}
