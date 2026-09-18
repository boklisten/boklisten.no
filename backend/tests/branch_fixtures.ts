import Branch from "#models/branch";
import BranchPeriod from "#models/branch_period";
import type { Branch as BranchDto } from "#shared/branch";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

/**
 * Inserts a branch (and its periods) into the test Postgres with every required column filled.
 * Pass only what the test cares about.
 */
export async function createBranch(overrides: Partial<BranchDto> = {}): Promise<Branch> {
  sequence++;
  const { rentPeriods = [], extendPeriods = [], partlyPaymentPeriods = [], ...columns } = overrides;
  const branch = await Branch.create({
    id: fixtureId(`b${sequence.toString(16)}`),
    name: `Filial ${sequence}`,
    logo: null,
    type: null,
    parentBranchId: null,
    localName: null,
    childLabel: null,
    active: true,
    paymentResponsible: false,
    responsibleForDelivery: false,
    buyoutPercentage: 1,
    sellPercentage: 1,
    deliveryAtBranch: true,
    deliveryByMail: true,
    branchItemsLiveOnline: true,
    region: "Oslo",
    address: null,
    ...columns,
  });
  await BranchPeriod.createMany(
    BranchPeriod.rowsFor(branch.id, { rentPeriods, extendPeriods, partlyPaymentPeriods }),
  );
  await branch.load("periods", (periods) => void periods.orderBy("id"));
  return branch;
}

/** A complete plain `Branch` for pure functions that never touch the database. */
export function branchDto(overrides: Partial<BranchDto> = {}): BranchDto {
  return {
    id: "branch1",
    name: "Testskolen",
    logo: null,
    type: null,
    parentBranchId: null,
    localName: null,
    childLabel: null,
    active: true,
    paymentResponsible: false,
    responsibleForDelivery: false,
    buyoutPercentage: 1,
    sellPercentage: 1,
    deliveryAtBranch: true,
    deliveryByMail: true,
    branchItemsLiveOnline: true,
    region: "Oslo",
    address: null,
    rentPeriods: [],
    extendPeriods: [],
    partlyPaymentPeriods: [],
    ...overrides,
  };
}
