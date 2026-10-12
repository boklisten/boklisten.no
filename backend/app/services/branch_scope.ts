import db from "@adonisjs/lucid/services/db";
import type { DatabaseQueryBuilderContract } from "@adonisjs/lucid/types/querybuilder";

import Branch from "#models/branch";

/**
 * The one scope rule of the branch tree: every admin list answers "what is at or below node X"
 * through these helpers, and no endpoint writes its own scope SQL.
 *
 * Scope is not a partition. A pupil who ordered at another school is in scope of both, so the
 * customer counts of sibling nodes do not sum to their parent's.
 */
export const BranchScope = {
  /** The ids of the node and every branch below it. */
  async subtreeIds(nodeId: string): Promise<string[]> {
    return [nodeId, ...(await Branch.descendantIds(nodeId))];
  },

  /** The ids of every branch above the node, nearest first: the ones whose staff see the node too. */
  ancestorIds(nodeId: string): Promise<string[]> {
    return Branch.ancestorIds(nodeId);
  },

  /**
   * A subquery of the ids of the customers in scope of a subtree (`subtreeIds`), for
   * `whereIn("customer_id", …)`: its members, plus anyone who ever ordered or was handed a book
   * there. Activity is unbounded in time and state (a cancelled order or a book returned years ago
   * still counts), so stand staff can see and fix a privatist who ordered at their school but never
   * picked it. Synchronous on purpose: a query builder is a thenable, so an async function would
   * run it instead of returning it.
   */
  customersInScope(subtreeIds: string[]): DatabaseQueryBuilderContract {
    return db
      .from("users")
      .select("id")
      .where((users) => {
        void users
          .whereIn("branch_membership_id", subtreeIds)
          .orWhereExists((orders) => {
            void orders
              .from("orders")
              .whereColumn("orders.customer_id", "users.id")
              .whereIn("orders.branch_id", subtreeIds);
          })
          .orWhereExists((customerItems) => {
            void customerItems
              .from("customer_items")
              .whereColumn("customer_items.customer_id", "users.id")
              .whereIn("customer_items.handout_branch_id", subtreeIds);
          });
      });
  },
};
