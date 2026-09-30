import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { childrenOf } from "@/features/branch-walk/branchTree";
import BranchWalkStep from "@/features/branch-walk/BranchWalkStep";
import { OPENING_HOURS_WALK, openingHoursTreeOptions } from "@/features/info/openingHoursWalk";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import ContactInfo from "@/shared/components/ContactInfo";
import { seo } from "@/shared/utils/seo";

/**
 * The top of the opening-hours walk: the same step down the branch tree as when ordering, but
 * only through the branches with a stand ahead, so the walk is as short as the season allows.
 */
export const Route = createFileRoute("/(offentlig)/info/branch/")({
  head: () =>
    seo({
      title: "Skoler og åpningstider | Boklisten.no",
      description: "Skal du hente eller levere bøker? Finn ut når vi står på stand på din skole.",
    }),
  loader: async ({ context }) => {
    const tree = await context.queryClient.query(openingHoursTreeOptions());
    const top = childrenOf(tree, null);
    // A single way in is no choice; go straight to it.
    if (top.length === 1 && top[0]) {
      throw redirect({
        to: "/info/branch/$branchId",
        params: { branchId: top[0].id },
        replace: true,
      });
    }
  },
  component: OpeningHoursPage,
});

function OpeningHoursPage() {
  const { data: tree } = useSuspenseQuery(openingHoursTreeOptions());
  return (
    <BranchWalkStep
      walk={OPENING_HOURS_WALK}
      tree={tree}
      parent={null}
      empty={
        <>
          <InfoAlert title="Ingen åpningstider er lagt ut enda">
            Standtidene legges ut et par uker før skolestart, og igjen før innlevering. Du kan
            bestille bøker i Posten, eller kontakte oss for spørsmål.
          </InfoAlert>
          <ContactInfo />
        </>
      }
    />
  );
}
