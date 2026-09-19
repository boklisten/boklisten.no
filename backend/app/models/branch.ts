import { Exception } from "@adonisjs/core/exceptions";
import db from "@adonisjs/lucid/services/db";
import { beforeCreate, beforeFetch, beforeFind, hasMany } from "@adonisjs/lucid/orm";
import type { ModelQueryBuilderContract } from "@adonisjs/lucid/types/model";
import type { HasMany } from "@adonisjs/lucid/types/relations";

import BranchPeriod from "#models/branch_period";
import type { PeriodKind } from "#models/branch_period";
import { assignObjectId } from "#models/helpers/object_id";
import { BranchSchema } from "#database/schema";
import type {
  Branch as BranchDto,
  BranchType,
  ExtendPeriod,
  PartlyPaymentPeriod,
  RentPeriod,
} from "#shared/branch";

/**
 * A school, one of its year groups or classes, a privatist school or the web shop; see
 * `shared/branch.ts` for the field semantics. Branches form a tree through `parentBranchId`.
 *
 * The payment periods live in `branch_periods` and are part of what a branch is, so every read
 * through this model preloads them (hooks below) and exposes them as the three typed lists the
 * API and the services address. A branch built with `create` has no periods loaded; use
 * `Branch.load("periods")` or the helpers in `branch_service.ts`.
 */
export default class Branch extends BranchSchema {
  static override selfAssignPrimaryKey = true;

  declare type: BranchType | null;

  @hasMany(() => BranchPeriod)
  declare periods: HasMany<typeof BranchPeriod>;

  @beforeCreate()
  static assignId(branch: Branch) {
    assignObjectId(branch);
  }

  @beforeFind()
  static preloadPeriodsOnFind(query: ModelQueryBuilderContract<typeof Branch>) {
    Branch.preloadPeriods(query);
  }

  @beforeFetch()
  static preloadPeriodsOnFetch(query: ModelQueryBuilderContract<typeof Branch>) {
    Branch.preloadPeriods(query);
  }

  /** List order is the order the periods were saved in (the form's order). */
  static preloadPeriods(query: ModelQueryBuilderContract<typeof Branch>) {
    void query.preload("periods", (periods) => void periods.orderBy("id"));
  }

  get rentPeriods(): RentPeriod[] {
    return this.periodsOf("rent").map((period) => period.toRentPeriod());
  }

  get extendPeriods(): ExtendPeriod[] {
    return this.periodsOf("extend").map((period) => period.toExtendPeriod());
  }

  get partlyPaymentPeriods(): PartlyPaymentPeriod[] {
    return this.periodsOf("partly_payment").map((period) => period.toPartlyPaymentPeriod());
  }

  /**
   * The API shape: the row plus the three period lists. A plain object rather than a transformer
   * so Tuyau types the period dates the way every other endpoint does.
   */
  toDto(): BranchDto {
    return {
      id: this.id,
      name: this.name,
      logo: this.logo,
      type: this.type,
      parentBranchId: this.parentBranchId,
      localName: this.localName,
      childLabel: this.childLabel,
      active: this.active,
      paymentResponsible: this.paymentResponsible,
      responsibleForDelivery: this.responsibleForDelivery,
      buyoutPercentage: this.buyoutPercentage,
      sellPercentage: this.sellPercentage,
      deliveryAtBranch: this.deliveryAtBranch,
      deliveryByMail: this.deliveryByMail,
      branchItemsLiveOnline: this.branchItemsLiveOnline,
      region: this.region,
      address: this.address,
      rentPeriods: this.rentPeriods,
      extendPeriods: this.extendPeriods,
      partlyPaymentPeriods: this.partlyPaymentPeriods,
    };
  }

  private periodsOf(kind: PeriodKind): BranchPeriod[] {
    const periods: unknown = this.$preloaded["periods"];
    if (!Array.isArray(periods)) {
      throw new TypeError(`Branch ${this.id}: periods were not loaded`);
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the preloaded hasMany relation
    return (periods as BranchPeriod[]).filter((period) => period.kind === kind);
  }

  /** Every branch, sorted the way Norwegians read names (Æ, Ø and Å after Z). */
  static async allByName(): Promise<Branch[]> {
    return byName(await this.all());
  }

  /** What customers may pick from: active branches whose books are orderable online. */
  static async publicByName(): Promise<Branch[]> {
    return byName(await this.query().where("active", true).where("branch_items_live_online", true));
  }

  /** `find` for references that may be absent. */
  static async findOptional(id: string | null | undefined): Promise<Branch | null> {
    return id ? this.find(id) : null;
  }

  /** `findOrFail` for references the legacy documents type as optional but the flow requires. */
  static async getOrFail(id: string | null | undefined): Promise<Branch> {
    const branch = await this.findOptional(id);
    if (branch === null) {
      throw new Exception(`Fant ikke filial ${id ?? ""}`, { status: 404, code: "E_ROW_NOT_FOUND" });
    }
    return branch;
  }

  /**
   * The branches with the given ids, keyed by id. Ids that do not exist are simply absent, which
   * is how callers joining branch data onto Mongo query results detect a dangling reference.
   */
  static async byIds(ids: Iterable<string | null | undefined>): Promise<Map<string, Branch>> {
    const unique = [...new Set([...ids].filter((id): id is string => typeof id === "string"))];
    if (unique.length === 0) {
      return new Map();
    }
    const branches = await this.findMany(unique);
    return new Map(branches.map((branch) => [branch.id, branch]));
  }

  static async namesByIds(ids: Iterable<string | null | undefined>): Promise<Map<string, string>> {
    const branches = await this.byIds(ids);
    return new Map([...branches].map(([id, branch]) => [id, branch.name]));
  }

  /**
   * Every branch below `branchId` in the tree (children, grandchildren, …), excluding the branch
   * itself. Ids and names only; the recursion happens in Postgres.
   */
  static descendants(branchId: string): Promise<BranchRef[]> {
    return this.walkDescendants(branchId, "");
  }

  static async descendantIds(branchId: string): Promise<string[]> {
    return (await this.descendants(branchId)).map((branch) => branch.id);
  }

  /** The descendants of `branchId` that have no children of their own: the classes students belong to. */
  static leafDescendants(branchId: string): Promise<BranchRef[]> {
    return this.walkDescendants(
      branchId,
      "WHERE NOT EXISTS (SELECT 1 FROM branches child WHERE child.parent_branch_id = tree.id)",
    );
  }

  private static async walkDescendants(branchId: string, filter: string): Promise<BranchRef[]> {
    const { rows } = await db.rawQuery<{ rows: BranchRef[] }>(
      `WITH RECURSIVE tree AS (
         SELECT id, name FROM branches WHERE parent_branch_id = :branchId
         UNION
         SELECT child.id, child.name FROM branches child JOIN tree ON child.parent_branch_id = tree.id
       )
       SELECT id, name FROM tree ${filter} ORDER BY name`,
      { branchId },
    );
    return rows;
  }
}

/** A branch reduced to what pickers and tree walks need. */
interface BranchRef {
  id: string;
  name: string;
}

function byName(branches: Branch[]): Branch[] {
  return branches.toSorted((a, b) => a.name.localeCompare(b.name, "nb"));
}
