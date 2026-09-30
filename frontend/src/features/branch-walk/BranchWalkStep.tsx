import type { PublicBranchNode, PublicBranchTree } from "@boklisten/backend/shared/branch";
import { IconChevronRight } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { childrenOf, pathTo, shortName, stepLabel } from "@/features/branch-walk/branchTree";
import BranchWalkHeader from "@/features/branch-walk/BranchWalkHeader";
import useMembershipBranch from "@/features/branch-walk/useMembershipBranch";
import type { BranchWalk } from "@/features/branch-walk/walk";
import classes from "@/features/branch-walk/walk.module.css";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

/**
 * One step down the tree: the branches under `parent` (the top of the tree when `null`) as cards,
 * each previewing what lies beneath it. At the top, a member's own school comes first. A walk
 * whose tree can run dry (opening hours out of season) says so with `empty`.
 */
export default function BranchWalkStep({
  walk,
  tree,
  parent,
  empty,
}: {
  walk: BranchWalk;
  tree: PublicBranchTree;
  parent: PublicBranchNode | null;
  empty?: ReactNode;
}) {
  const choices = childrenOf(tree, parent?.id ?? null);
  const own = useMembershipBranch(walk, tree);
  const showOwn = parent === null && own !== null;
  const label = stepLabel(tree, parent);

  if (choices.length === 0 && empty !== undefined) {
    return (
      <>
        <BranchWalkHeader walk={walk} path={[]} title={walk.top.label} />
        <div className={classes.empty}>{empty}</div>
      </>
    );
  }

  return (
    <>
      <BranchWalkHeader
        walk={walk}
        path={parent ? pathTo(tree, parent) : []}
        title={`Velg ${label}`}
      />
      {showOwn && (
        <>
          <TanStackAnchor
            to={walk.step}
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
          <p className={classes.sectionLabel}>Eller velg en annen {label}</p>
        </>
      )}
      <ul className={classes.grid}>
        {choices.map((choice) => (
          <li key={choice.id}>
            <TanStackAnchor
              to={walk.step}
              params={{ branchId: choice.id }}
              className={classes.card}
              underline="never"
            >
              <span className={classes.cardText}>
                <span className={classes.cardName}>{shortName(choice)}</span>
                <Preview walk={walk} tree={tree} node={choice} />
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

/** What choosing this card leads to: the names below it, or that the walk ends one step away. */
function Preview({
  walk,
  tree,
  node,
}: {
  walk: BranchWalk;
  tree: PublicBranchTree;
  node: PublicBranchNode;
}) {
  if (node.isLeaf) {
    return <span className={classes.cardMeta}>{walk.leafLabel}</span>;
  }
  const below = childrenOf(tree, node.id).map(shortName);
  return <span className={classes.cardMeta}>{below.join(", ")}</span>;
}
