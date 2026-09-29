import type { ReactNode } from "react";

import type { BranchManagerTab } from "@/features/branches/branchManagerTabs";
import type { BranchRef } from "@/features/branches/inheritance/useInheritedField";
import EntityLink from "@/shared/components/EntityLink";

/**
 * A link to the same tab on another branch, e.g. up to the parent a value comes from. Shows the
 * branch's name unless `children` gives the whole phrase ("↑ Arvet fra EL"), which is then one
 * link.
 */
export default function InheritanceSourceLink({
  branch,
  tab,
  onClick,
  className,
  fw,
  children,
}: {
  branch: BranchRef;
  tab: BranchManagerTab;
  onClick?: () => void;
  className?: string;
  fw?: number;
  children?: ReactNode;
}) {
  return (
    <EntityLink
      fz="inherit"
      lh="inherit"
      fw={fw}
      className={className}
      to="/admin/database/filialer"
      search={(previous) => ({ ...previous, filial: branch.id, filialFane: tab })}
      onClick={onClick}
    >
      {children ?? branch.name}
    </EntityLink>
  );
}
