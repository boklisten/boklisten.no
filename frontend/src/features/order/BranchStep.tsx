import type { PublicBranchNode, PublicBranchTree } from "@boklisten/backend/shared/branch";
import { IconChevronRight } from "@tabler/icons-react";

import classes from "@/features/order/order.module.css";
import OrderStepHeader from "@/features/order/OrderStepHeader";
import { childrenOf, pathTo, shortName, stepLabel } from "@/features/order/orderTree";
import useMembershipBranch from "@/features/order/useMembershipBranch";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

/**
 * One step down the tree: the branches under `parent` (the top of the tree when `null`) as cards,
 * each previewing what lies beneath it. At the top, a member's own school comes first.
 */
export default function BranchStep({
  tree,
  parent,
}: {
  tree: PublicBranchTree;
  parent: PublicBranchNode | null;
}) {
  const choices = childrenOf(tree, parent?.id ?? null);
  const own = useMembershipBranch(tree);
  const showOwn = parent === null && own !== null;

  return (
    <>
      <OrderStepHeader
        path={parent ? pathTo(tree, parent) : []}
        title={`Velg ${stepLabel(tree, parent)}`}
      />
      {showOwn && (
        <>
          <TanStackAnchor
            to="/bestilling/$branchId"
            params={{ branchId: own.id }}
            className={`${classes.card} ${classes.ownCard}`}
            underline="never"
          >
            <span className={classes.cardText}>
              <span className={classes.ownLabel}>Din skole</span>
              <span className={classes.cardName}>{own.name}</span>
            </span>
            <IconChevronRight className={classes.cardChevron} size={20} stroke={1.8} aria-hidden />
          </TanStackAnchor>
          <p className={classes.sectionLabel}>Eller velg en annen skole</p>
        </>
      )}
      <ul className={classes.grid}>
        {choices.map((choice) => (
          <li key={choice.id}>
            <TanStackAnchor
              to="/bestilling/$branchId"
              params={{ branchId: choice.id }}
              className={classes.card}
              underline="never"
            >
              <span className={classes.cardText}>
                <span className={classes.cardName}>{shortName(choice)}</span>
                <Preview tree={tree} node={choice} />
              </span>
              <IconChevronRight
                className={classes.cardChevron}
                size={20}
                stroke={1.8}
                aria-hidden
              />
            </TanStackAnchor>
          </li>
        ))}
      </ul>
    </>
  );
}

/** What choosing this card leads to: the names below it, or that the books are one step away. */
function Preview({ tree, node }: { tree: PublicBranchTree; node: PublicBranchNode }) {
  if (node.hasBooks) {
    return <span className={classes.cardMeta}>Velg fag</span>;
  }
  const below = childrenOf(tree, node.id).map(shortName);
  return <span className={classes.cardMeta}>{below.join(", ")}</span>;
}
