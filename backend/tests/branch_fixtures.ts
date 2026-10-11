import db from "@adonisjs/lucid/services/db";

import Branch, { overrideColumn } from "#models/branch";
import BranchPeriod from "#models/branch_period";
import { overrideColumns } from "#services/branch_inheritance_service";
import type { Branch as BranchDto, InheritedValues } from "#shared/branch";
import { INHERITED_BRANCH_FIELDS } from "#shared/branch-inheritance";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

/** The id `rootBranch` gives the test root, for fixtures that need it before any query. */
export const TEST_ROOT_BRANCH_ID = fixtureId("a11e");

/** What the test root holds; the real root's values came with its migration. */
export const ROOT_VALUES: InheritedValues = {
  visibleToCustomers: false,
  deliveryAtBranch: true,
  deliveryByMail: true,
  paymentResponsible: false,
  responsibleForDelivery: false,
  buyoutPercentage: 1,
  sellPercentage: 1,
};

/** What a top-level fixture branch holds unless the test says otherwise: visible to customers, so every viewer sees it. */
const FIXTURE_TOP_VALUES = { ...ROOT_VALUES, visibleToCustomers: true } as const;

/**
 * The one root of the test tree ("Alle filialer", hidden from customers like the real one), created on
 * first use after each truncate. Every branch a test creates without a parent sits directly under
 * it, so the tree has a single root the way the `branches_single_root` index requires.
 */
export async function rootBranch(): Promise<Branch> {
  // Fixtures are often created in parallel, so the insert is idempotent rather than guarded by a
  // read.
  await db
    .table("branches")
    .insert({
      id: TEST_ROOT_BRANCH_ID,
      name: "Alle filialer",
      parent_branch_id: null,
      local_name: null,
      child_label: "selskap",
      address: null,
      created_at: new Date(),
      updated_at: new Date(),
      ...Object.fromEntries(
        INHERITED_BRANCH_FIELDS.map((field) => [overrideColumn(field), ROOT_VALUES[field]]),
      ),
    })
    .onConflict()
    .ignore();
  return Branch.root();
}

/**
 * Inserts a branch (and its periods) into the test Postgres with every required column filled.
 * Pass only what the test cares about, as the values in force. A branch given no parent goes
 * under the root (`rootBranch`) and holds every inherited field itself (`FIXTURE_TOP_VALUES`
 * where not given), so what it inherits from the root never shows; a branch under a parent
 * overrides exactly the fields given.
 */
export async function createBranch(overrides: Partial<BranchDto> = {}): Promise<Branch> {
  sequence++;
  const {
    rentPeriods = [],
    extendPeriods = [],
    partlyPaymentPeriods = [],
    overrides: _overrides,
    ...given
  } = overrides;
  const isTopLevel = (given.parentBranchId ?? null) === null;
  const stored = overrideColumns(
    Object.fromEntries(
      INHERITED_BRANCH_FIELDS.map((field) => [
        field,
        given[field] ?? (isTopLevel ? FIXTURE_TOP_VALUES[field] : null),
      ]),
    ),
  );
  const columns = Object.fromEntries(
    Object.entries(given).filter(
      ([key]) => !INHERITED_BRANCH_FIELDS.some((field) => field === key),
    ),
  );
  const branch = await Branch.create({
    id: fixtureId(`b${sequence.toString(16)}`),
    name: `Filial ${sequence}`,
    localName: null,
    childLabel: null,
    address: null,
    ...stored,
    ...columns,
    parentBranchId: isTopLevel ? (await rootBranch()).id : given.parentBranchId,
  });
  await BranchPeriod.createMany(
    BranchPeriod.rowsFor(branch.id, { rentPeriods, extendPeriods, partlyPaymentPeriods }),
  );
  return Branch.findOrFail(branch.id);
}

/** A complete plain `Branch` for pure functions that never touch the database. */
export function branchDto(overrides: Partial<BranchDto> = {}): BranchDto {
  const dto = { ...FIXTURE_TOP_VALUES, ...overrides };
  return {
    id: "branch1",
    name: "Testskolen",
    parentBranchId: null,
    localName: null,
    childLabel: null,
    paymentResponsible: false,
    responsibleForDelivery: false,
    buyoutPercentage: 1,
    sellPercentage: 1,
    deliveryAtBranch: true,
    deliveryByMail: true,
    visibleToCustomers: true,
    address: null,
    rentPeriods: [],
    extendPeriods: [],
    partlyPaymentPeriods: [],
    ...overrides,
    overrides: {
      visibleToCustomers: dto.visibleToCustomers,
      deliveryAtBranch: dto.deliveryAtBranch,
      deliveryByMail: dto.deliveryByMail,
      paymentResponsible: dto.paymentResponsible,
      responsibleForDelivery: dto.responsibleForDelivery,
      buyoutPercentage: dto.buyoutPercentage,
      sellPercentage: dto.sellPercentage,
      ...overrides.overrides,
    },
  };
}
