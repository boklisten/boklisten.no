/**
 * A walk down the branch tree, one step per level, ending at the branches that hold what the walk
 * is for: subjects to order, or a stand's opening hours. The two walks share the step page; this
 * says where a walk starts and which route its steps live on. Each walk's routes fetch its tree.
 */
export interface BranchWalk {
  /** Tells the walks' caches apart. */
  key: "order" | "opening-hours";
  /** The first step, and the name it goes by in the breadcrumbs. */
  top: { to: "/bestilling" | "/info/branch"; label: string };
  /** Every later step, keyed by the branch it shows. */
  step: "/bestilling/$branchId" | "/info/branch/$branchId";
  /** What a card says the walk ends in, under the name of a branch that ends it. */
  leafLabel: string;
}
