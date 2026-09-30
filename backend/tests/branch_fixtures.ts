import Branch from "#models/branch";
import BranchPeriod from "#models/branch_period";
import { ROOT_VALUES, overrideColumns } from "#services/branch_inheritance_service";
import type { Branch as BranchDto } from "#shared/branch";
import { INHERITED_BRANCH_FIELDS } from "#shared/branch-inheritance";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

/** What a fixture root holds unless the test says otherwise: public, so every viewer sees it. */
const FIXTURE_ROOT_VALUES = { ...ROOT_VALUES, visibility: "public" } as const;

/**
 * Inserts a branch (and its periods) into the test Postgres with every required column filled.
 * Pass only what the test cares about, as the values in force. A root holds every inherited
 * field (`FIXTURE_ROOT_VALUES` where not given); a child overrides exactly the fields given.
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
  const isRoot = (given.parentBranchId ?? null) === null;
  const stored = overrideColumns(
    Object.fromEntries(
      INHERITED_BRANCH_FIELDS.map((field) => [
        field,
        given[field] ?? (isRoot ? FIXTURE_ROOT_VALUES[field] : null),
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
    parentBranchId: null,
    localName: null,
    childLabel: null,
    address: null,
    ...stored,
    ...columns,
  });
  await BranchPeriod.createMany(
    BranchPeriod.rowsFor(branch.id, { rentPeriods, extendPeriods, partlyPaymentPeriods }),
  );
  return Branch.findOrFail(branch.id);
}

/** A complete plain `Branch` for pure functions that never touch the database. */
export function branchDto(overrides: Partial<BranchDto> = {}): BranchDto {
  const dto = { ...FIXTURE_ROOT_VALUES, ...overrides };
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
    visibility: "public",
    address: null,
    rentPeriods: [],
    extendPeriods: [],
    partlyPaymentPeriods: [],
    ...overrides,
    overrides: {
      visibility: dto.visibility,
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
