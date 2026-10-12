import db from "@adonisjs/lucid/services/db";
import type { DatabaseQueryBuilderContract } from "@adonisjs/lucid/types/querybuilder";

import BadRequestException from "#exceptions/bad_request_exception";
import NotFoundException from "#exceptions/not_found_exception";
import Branch from "#models/branch";
import Order from "#models/order";
import type User from "#models/user";
import { canSeeBranch } from "#shared/branch-visibility";
import { USER_PERMISSION, hasPermissionLevel } from "#shared/user-permission";

/**
 * Who is looking: their level and home node. The methods that guests may reach take
 * `Viewer | null`, where `null` is a guest: a customer homed at the root.
 */
export type Viewer = Pick<User, "permission" | "employeeBranchId">;

/** One row of a viewer's slice of the tree: the branch and whether the viewer may work on it. */
export interface SliceNode {
  branch: Branch;
  selectable: boolean;
}

/**
 * The one scope rule of the branch tree: every admin list answers "what is at or below node X"
 * through these helpers, and no endpoint writes its own scope SQL.
 *
 * Scope is not a partition. A pupil who ordered at another school is in scope of both, and a
 * customer with no school is in scope of everyone, so the customer counts of sibling nodes do
 * not sum to their parent's.
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
   * The viewer's slice of the tree, sorted by name: the branches they may work on (`selectable`)
   * and, for staff homed below the root, the path above their home node (`selectable: false`,
   * the connectors that show where inherited values come from).
   *
   * The selectable set is the subtree of the home node filtered by what the level may see, which
   * for staff is everything below the node. Customers and guests are homed at the root and get the
   * root (the "no school" option) and every public branch; staff homed at the root (admins, head
   * office) get every branch, the root included; staff homed below it get neither the root nor
   * anything beside their subtree. Both the tree endpoint and the guard read this one formula, so
   * they can never disagree.
   */
  async slice(viewer: Viewer | null): Promise<SliceNode[]> {
    const branches = (await Branch.query()).toSorted((a, b) => a.name.localeCompare(b.name, "nb"));
    const root = branches.find((branch) => branch.isRoot);
    if (root === undefined) {
      return [];
    }
    const permission = viewer?.permission ?? null;
    const isStaff = permission !== null && hasPermissionLevel(permission, "employee");
    const homeId = viewer?.employeeBranchId ?? root.id;
    const childrenOf = Map.groupBy(branches, (branch) => branch.parentBranchId);
    const subtree = new Set<string>();
    for (const queue = [homeId]; queue.length > 0;) {
      const id = queue.shift();
      if (id === undefined || subtree.has(id)) {
        continue;
      }
      subtree.add(id);
      queue.push(...(childrenOf.get(id) ?? []).map((child) => child.id));
    }
    const selectable = new Set(
      branches
        .filter(
          (branch) =>
            (!isStaff && branch.isRoot) ||
            (subtree.has(branch.id) && canSeeBranch(permission, branch.visibleToCustomers)),
        )
        .map((branch) => branch.id),
    );
    const connectors = new Set<string>();
    if (isStaff) {
      const byId = new Map(branches.map((branch) => [branch.id, branch]));
      for (
        let parentId = byId.get(homeId)?.parentBranchId ?? null;
        parentId !== null;
        parentId = byId.get(parentId)?.parentBranchId ?? null
      ) {
        connectors.add(parentId);
      }
    }
    return branches
      .filter((branch) => selectable.has(branch.id) || connectors.has(branch.id))
      .map((branch) => ({ branch, selectable: selectable.has(branch.id) }));
  },

  /** The ids of the branches the viewer may work on; see `slice`. */
  async selectableIds(viewer: Viewer | null): Promise<string[]> {
    return (await this.slice(viewer))
      .filter((node) => node.selectable)
      .map((node) => node.branch.id);
  },

  /** Whether the node is one the viewer may work on; see `slice`. */
  async isSelectable(viewer: Viewer | null, nodeId: string): Promise<boolean> {
    return (await this.selectableIds(viewer)).includes(nodeId);
  },

  /**
   * For a node named in a URL or query: a node the viewer may not work on is a 404, exactly like
   * an unknown id, so nothing about the rest of the tree leaks and a stale link never reads as
   * "no access" (which the frontend answers by logging out).
   */
  async assertSelectable(viewer: Viewer | null, nodeId: string): Promise<void> {
    if (!(await this.isSelectable(viewer, nodeId))) {
      throw new NotFoundException("Fant ikke filialen");
    }
  },

  /**
   * For a node named in a request body (where to move a customer, which branch an order gets):
   * the value is rejected (400) when the viewer may not work on it. Only the target is checked,
   * never the current value, so stand staff can pull in a pupil from elsewhere, and nobody homed
   * below the root can move anyone to it.
   */
  async assertSelectableTarget(viewer: Viewer | null, nodeId: string): Promise<void> {
    if (!(await this.isSelectable(viewer, nodeId))) {
      throw new BadRequestException("Du kan ikke velge denne filialen");
    }
  },

  /** The ids of the branches at or below the viewer's home node: how far their lists and lookups reach. */
  homeSubtreeIds(viewer: Viewer): Promise<string[]> {
    return this.subtreeIds(viewer.employeeBranchId);
  },

  /** Whether the customer is in scope of the viewer's home node (`customersInScope`); an unknown id is not. */
  async customerInScope(viewer: Viewer, customerId: string): Promise<boolean> {
    const rows: { id: string }[] = await db
      .from("users")
      .where("id", customerId)
      .whereIn("id", this.customersInScope(await this.homeSubtreeIds(viewer)))
      .select("id")
      .limit(1);
    return rows.length > 0;
  },

  /**
   * Which of the users a bulk upload (class list, fagvalg) may change for the viewer: those in
   * scope (`customersInScope`, where staff count by their home node) whose level is not above the
   * viewer's. An upload overwrites phone and email, the keys to an account, so anyone else would
   * be handed to whoever wrote the file at the next SMS login.
   */
  async manageableAmong(viewer: Viewer, userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }
    const rows: { id: string }[] = await db
      .from("users")
      .whereIn("id", userIds)
      .whereIn(
        "permission",
        Object.values(USER_PERMISSION).filter((level) =>
          hasPermissionLevel(viewer.permission, level),
        ),
      )
      .whereIn("id", this.customersInScope(await this.homeSubtreeIds(viewer)))
      .select("id");
    return new Set(rows.map((row) => row.id));
  },

  /** A customer outside the scope is a 404, so an out-of-scope id looks exactly like an unknown one. */
  async assertCustomerInScope(viewer: Viewer, customerId: string): Promise<void> {
    if (!(await this.customerInScope(viewer, customerId))) {
      throw new NotFoundException("Fant ingen kunde");
    }
  },

  /** Whether a place (an order's or a handout's branch) is at or below the viewer's home node. */
  async placeInScope(viewer: Viewer, branchId: string): Promise<boolean> {
    return (await this.homeSubtreeIds(viewer)).includes(branchId);
  },

  /**
   * A book of a customer in scope is in scope wherever it was handed out: staff serve people, and
   * a person they may see, they may see in full. Otherwise the book follows its place.
   */
  async customerItemInScope(
    viewer: Viewer,
    customerItem: { customerId: string | null; handoutBranchId: string },
  ): Promise<boolean> {
    return (
      (await this.placeInScope(viewer, customerItem.handoutBranchId)) ||
      (customerItem.customerId !== null &&
        (await this.customerInScope(viewer, customerItem.customerId)))
    );
  },

  /**
   * The order, when it exists and is in the viewer's scope (`orderInScope`); null otherwise, so
   * every caller answers an out-of-scope order exactly as it answers an unknown one.
   */
  async findOrderInScope(viewer: Viewer, orderId: string): Promise<Order | null> {
    const order = await Order.findOptional(orderId);
    return order !== null && (await this.orderInScope(viewer, order)) ? order : null;
  },

  /** As `customerItemInScope`, for an order: by its branch or by its customer. */
  async orderInScope(
    viewer: Viewer,
    order: { customerId: string | null; branchId: string },
  ): Promise<boolean> {
    return (
      (await this.placeInScope(viewer, order.branchId)) ||
      (order.customerId !== null && (await this.customerInScope(viewer, order.customerId)))
    );
  },

  /**
   * Whether a blid is in the viewer's scope: nobody holds it (a blank sticker belongs to whoever
   * has it in hand, and a book returned elsewhere is free again), any of its history was handed
   * out in the subtree (the book has been theirs, so they may see where it went), or whoever holds
   * it is a customer in scope. `UniqueItem.matching` states the same rule in SQL.
   */
  async blidInScope(viewer: Viewer, blid: string): Promise<boolean> {
    const history: { customerId: string | null; handoutBranchId: string; active: boolean }[] =
      await db
        .from("customer_items")
        .where("blid", blid)
        .select(
          "customer_id as customerId",
          "handout_branch_id as handoutBranchId",
          db.raw("(NOT returned AND NOT buyout AND NOT cancel AND NOT buyback) AS active"),
        );
    const ids = await this.homeSubtreeIds(viewer);
    if (history.some((row) => ids.includes(row.handoutBranchId))) {
      return true;
    }
    for (const holder of history.filter((row) => row.active)) {
      // A held row without a customer is a book in nobody's hands: free, like a returned one.
      if (holder.customerId !== null && !(await this.customerInScope(viewer, holder.customerId))) {
        return false;
      }
    }
    return true;
  },

  /**
   * A subquery of the ids of the customers in scope of a subtree (`subtreeIds`), for
   * `whereIn("customer_id", …)`: its members, everyone with no school (a root member belongs to
   * every stand, so a privatist who walks up without an order is found anywhere), plus anyone who
   * ever ordered or was handed a book there. Activity is unbounded in time and state (a cancelled
   * order or a book returned years ago still counts), so stand staff can see and fix a pupil of
   * another school who ordered at theirs. Staff must on top of that be homed in the subtree: head
   * office and admins are root members, and a school employee must not find, open or edit them.
   * Synchronous on purpose: a query builder is a thenable, so an async function would run it
   * instead of returning it.
   */
  customersInScope(subtreeIds: string[]): DatabaseQueryBuilderContract {
    return db
      .from("users")
      .select("id")
      .where((users) => {
        void users
          .where("permission", USER_PERMISSION.CUSTOMER)
          .orWhereIn("employee_branch_id", subtreeIds);
      })
      .where((users) => {
        void users
          .whereIn("branch_membership_id", subtreeIds)
          .orWhereExists((root) => {
            void root
              .from("branches")
              .whereNull("branches.parent_branch_id")
              .whereColumn("branches.id", "users.branch_membership_id");
          })
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
