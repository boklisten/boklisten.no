import { Exception } from "@adonisjs/core/exceptions";
import db from "@adonisjs/lucid/services/db";
import {
  afterFetch,
  afterFind,
  beforeCreate,
  beforeFetch,
  beforeFind,
  hasMany,
} from "@adonisjs/lucid/orm";
import type { TransactionClientContract } from "@adonisjs/lucid/types/database";
import type { ModelQueryBuilderContract } from "@adonisjs/lucid/types/model";
import type { HasMany } from "@adonisjs/lucid/types/relations";

import BranchPeriod from "#models/branch_period";
import type { PeriodKind } from "#models/branch_period";
import { assignObjectId, distinctIds } from "#models/helpers/object_id";
import { BranchSchema } from "#database/schema";
import { INHERITED_BRANCH_FIELDS, resolveInherited } from "#shared/branch-inheritance";
import type { InheritedBranchField } from "#shared/branch-inheritance";
import type { BranchVisibility } from "#shared/branch-visibility";
import { visibilitiesFor } from "#shared/branch-visibility";
import type { UserPermission } from "#shared/user-permission";
import type {
  Branch as BranchDto,
  BranchType,
  ExtendPeriod,
  InheritedOverrides,
  InheritedValues,
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
 *
 * The inherited fields are stored as `<field>Override` columns, `null` where the branch inherits
 * (`shared/branch-inheritance.ts`). Every read through this model also resolves them against the
 * ancestors (hooks below), and the getters named after the fields (`visibility`,
 * `paymentResponsible`, …) return the value in force; that is what every reader uses. Writes go
 * through `branch_service.ts`, which keeps the overrides in order.
 */
export default class Branch extends BranchSchema {
  static override selfAssignPrimaryKey = true;

  declare type: BranchType | null;

  declare visibilityOverride: BranchVisibility | null;

  /** The values in force, set by the read hooks; see `resolveInheritedValues`. */
  private inheritedValues?: InheritedValues;

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

  @afterFind()
  static async resolveOnFind(branch: Branch) {
    await Branch.resolveInheritedValues([branch]);
  }

  @afterFetch()
  static async resolveOnFetch(branches: Branch[]) {
    await Branch.resolveInheritedValues(branches);
  }

  /**
   * Resolves the inherited fields of `branches` over their ancestors, loaded in one recursive
   * query through the transaction the branches were read in, so a write inside `whileLocked`
   * reads back what it wrote.
   */
  static async resolveInheritedValues(branches: Branch[]): Promise<void> {
    if (branches.length === 0) {
      return;
    }
    const client = branches[0]?.$trx ?? db;
    const columns = INHERITED_BRANCH_FIELDS.map((field) => overrideColumn(field)).join(", ");
    const { rows } = await client.rawQuery<{
      rows: ({ id: string; parent_branch_id: string | null } & Record<string, unknown>)[];
    }>(
      `WITH RECURSIVE chain AS (
         SELECT id, parent_branch_id, ${columns} FROM branches WHERE id = ANY(:ids)
         UNION
         SELECT parent.id, parent.parent_branch_id, ${INHERITED_BRANCH_FIELDS.map((field) => `parent.${overrideColumn(field)}`).join(", ")}
         FROM branches parent JOIN chain ON parent.id = chain.parent_branch_id
       )
       SELECT * FROM chain`,
      { ids: branches.map((branch) => branch.id) },
    );
    const resolvedFields = INHERITED_BRANCH_FIELDS.map(
      (field) =>
        [
          field,
          resolveInherited(
            rows.map((row) => ({
              id: row.id,
              parentBranchId: row.parent_branch_id,
              override: row[overrideColumn(field)] ?? null,
            })),
          ),
        ] as const,
    );
    for (const branch of branches) {
      const values: Record<string, unknown> = {};
      for (const [field, resolved] of resolvedFields) {
        values[field] = resolved.get(branch.id)?.value;
      }
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- one entry per inherited field, typed by the column checks
      branch.inheritedValues = values as unknown as InheritedValues;
    }
  }

  /** List order is the order the periods were saved in (the form's order). */
  static preloadPeriods(query: ModelQueryBuilderContract<typeof Branch>) {
    void query.preload("periods", (periods) => void periods.orderBy("id"));
  }

  get visibility(): BranchVisibility {
    return this.inherited().visibility;
  }

  get paymentResponsible(): boolean {
    return this.inherited().paymentResponsible;
  }

  get responsibleForDelivery(): boolean {
    return this.inherited().responsibleForDelivery;
  }

  get buyoutPercentage(): number {
    return this.inherited().buyoutPercentage;
  }

  get sellPercentage(): number {
    return this.inherited().sellPercentage;
  }

  get deliveryAtBranch(): boolean {
    return this.inherited().deliveryAtBranch;
  }

  get deliveryByMail(): boolean {
    return this.inherited().deliveryByMail;
  }

  /** What the branch stores per inherited field: its own value, or `null` where it inherits. */
  get overrides(): InheritedOverrides {
    return {
      visibility: this.visibilityOverride,
      paymentResponsible: this.paymentResponsibleOverride,
      responsibleForDelivery: this.responsibleForDeliveryOverride,
      buyoutPercentage: this.buyoutPercentageOverride,
      sellPercentage: this.sellPercentageOverride,
      deliveryAtBranch: this.deliveryAtBranchOverride,
      deliveryByMail: this.deliveryByMailOverride,
    };
  }

  get rentPeriods(): RentPeriod[] {
    return this.periodsOf("rent").map((period) => period.toRentPeriod());
  }

  get extendPeriods(): ExtendPeriod[] {
    return this.periodsOf("extend").map((period) => period.toExtendPeriod());
  }

  get partlyPaymentPeriods(): PartlyPaymentPeriod[] {
    return this.periodsOf("partly-payment").map((period) => period.toPartlyPaymentPeriod());
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
      ...this.inherited(),
      overrides: this.overrides,
      region: this.region,
      address: this.address,
      rentPeriods: this.rentPeriods,
      extendPeriods: this.extendPeriods,
      partlyPaymentPeriods: this.partlyPaymentPeriods,
    };
  }

  private inherited(): InheritedValues {
    if (!this.inheritedValues) {
      throw new TypeError(`Branch ${this.id}: inherited values were not resolved`);
    }
    return this.inheritedValues;
  }

  private periodsOf(kind: PeriodKind): BranchPeriod[] {
    const periods: unknown = this.$preloaded["periods"];
    if (!Array.isArray(periods)) {
      throw new TypeError(`Branch ${this.id}: periods were not loaded`);
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the preloaded hasMany relation
    return (periods as BranchPeriod[]).filter((period) => period.kind === kind);
  }

  /**
   * Runs `work` in a transaction holding the tree lock; every branch write goes through here, so
   * what a write resolves over the tree (`keepValuesInForce`, the read-back of the values in
   * force) is computed on the tree as it is, not on a snapshot another write is changing. Never
   * nest: the lock is per transaction.
   */
  static whileLocked<T>(work: (trx: TransactionClientContract) => Promise<T>): Promise<T> {
    return db.transaction(async (trx) => {
      await trx.rawQuery("SELECT pg_advisory_xact_lock(hashtext(?))", ["branches:tree"]);
      return work(trx);
    });
  }

  /**
   * The branches a viewer with `permission` (`null` for a guest) may see, sorted the way Norwegians
   * read names (Æ, Ø and Å after Z).
   */
  static async visibleByName(permission: UserPermission | null): Promise<Branch[]> {
    const visible = new Set(visibilitiesFor(permission));
    return byName((await this.query()).filter((branch) => visible.has(branch.visibility)));
  }

  /** What customers may order from online: public branches with at least one subject book. */
  static async orderableByName(): Promise<Branch[]> {
    const withBooks = await this.query().whereExists((subjects) =>
      subjects
        .from("branch_subjects")
        .join(
          "branch_subject_books",
          "branch_subject_books.branch_subject_id",
          "branch_subjects.id",
        )
        .whereColumn("branch_subjects.branch_id", "branches.id"),
    );
    return byName(withBooks.filter((branch) => branch.visibility === "public"));
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
   * is how callers joining branch data onto other query results detect a dangling reference.
   */
  static async byIds(ids: Iterable<string | null | undefined>): Promise<Map<string, Branch>> {
    const unique = distinctIds(ids);
    if (unique.length === 0) {
      return new Map();
    }
    const branches = await this.findMany(unique);
    return new Map(branches.map((branch) => [branch.id, branch]));
  }

  static async namesByIds(ids: Iterable<string | null | undefined>): Promise<Map<string, string>> {
    const rows: { id: string; name: string }[] = await db
      .from("branches")
      .whereIn("id", distinctIds(ids))
      .select("id", "name");
    return new Map(rows.map(({ id, name }) => [id, name]));
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

/** The column that stores `field`'s override. */
export function overrideColumn(field: InheritedBranchField): string {
  return `${field.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_override`;
}

function byName(branches: Branch[]): Branch[] {
  return branches.toSorted((a, b) => a.name.localeCompare(b.name, "nb"));
}
