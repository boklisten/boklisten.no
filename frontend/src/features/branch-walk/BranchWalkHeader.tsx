import type { PublicBranchNode } from "@boklisten/backend/shared/branch";
import { Breadcrumbs } from "@mantine/core";
import type { ReactNode } from "react";

import { shortName } from "@/features/branch-walk/branchTree";
import type { BranchWalk } from "@/features/branch-walk/walk";
import classes from "@/features/branch-walk/walk.module.css";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

/** The step's title, with the way back up the tree above it when there is one. */
export default function BranchWalkHeader({
  walk,
  path,
  title,
  children,
}: {
  walk: BranchWalk;
  /** The branches above this step, top first; the last one is the current branch. */
  path: PublicBranchNode[];
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className={classes.head}>
      {path.length > 0 && (
        <Breadcrumbs
          separator="›"
          classNames={{ root: classes.crumbs, separator: classes.crumbSep }}
        >
          <TanStackAnchor to={walk.top.to} className={classes.crumb}>
            {walk.top.label}
          </TanStackAnchor>
          {path.slice(0, -1).map((node) => (
            <TanStackAnchor
              key={node.id}
              to={walk.step}
              params={{ branchId: node.id }}
              className={classes.crumb}
            >
              {shortName(node)}
            </TanStackAnchor>
          ))}
          <span className={classes.crumbCurrent}>{shortName(path.at(-1)!)}</span>
        </Breadcrumbs>
      )}
      <h1 className={classes.title}>{title}</h1>
      {children}
    </header>
  );
}
