import Company from "#models/company";
import type { Company as CompanyDto } from "#shared/company";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

/** Inserts a company into the test Postgres with every column filled; pass only what the test cares about. */
export async function createCompany(overrides: Partial<CompanyDto> = {}): Promise<Company> {
  sequence++;
  return Company.create({
    id: fixtureId(`c${sequence.toString(16)}`),
    name: `Selskap ${sequence}`,
    phone: "99240588",
    email: `selskap${sequence}@example.com`,
    address: "Storgata 1",
    postCode: "0155",
    postCity: "Oslo",
    customerNumber: `${900_000_000 + sequence}`,
    organizationNumber: `${900_000_000 + sequence}`,
    ...overrides,
  });
}
