import { DateTime } from "luxon";

import User from "#models/user";
import type { User as UserDto } from "#shared/user";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

type UserColumns = Omit<UserDto, "dob" | "createdAt"> & {
  dob: DateTime | null;
  localHashedPassword: string | null;
  vippsUserId: string | null;
};

/**
 * Inserts a user into the test Postgres with every required column filled and a unique email,
 * phone and blid. Pass only what the test cares about.
 */
export async function createUser(overrides: Partial<UserColumns> = {}): Promise<User> {
  sequence++;
  return User.create({
    id: fixtureId(`c${sequence.toString(16)}`),
    name: `Kunde ${sequence}`,
    email: `kunde${sequence}@example.com`,
    phone: String(90_000_000 + sequence),
    address: "Testveien 1",
    postCode: "0150",
    postCity: "Oslo",
    emailConfirmed: true,
    dob: DateTime.fromISO("2000-01-01"),
    guardianName: null,
    guardianEmail: null,
    guardianPhone: null,
    blid: `u#${sequence.toString(16).padStart(32, "0")}`,
    branchMembershipId: null,
    taskConfirmDetails: false,
    taskSignAgreement: false,
    permission: "customer",
    localHashedPassword: null,
    vippsUserId: null,
    ...overrides,
  });
}

/**
 * A `User` model instance that never touches the database, for stubbing model lookups in specs
 * that stub every storage call. Saving it would insert a row, so only hand it to code that reads.
 */
export function userDouble(overrides: Partial<UserColumns> & { id?: string } = {}): User {
  const user = new User();
  // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type -- Lucid's fill, not Array#fill
  user.fill({
    id: fixtureId("c0"),
    name: "Kari Nordmann",
    email: "kari@example.com",
    phone: "90000000",
    address: "Testveien 1",
    postCode: "0150",
    postCity: "Oslo",
    emailConfirmed: true,
    dob: DateTime.fromISO("2000-01-01"),
    guardianName: null,
    guardianEmail: null,
    guardianPhone: null,
    blid: "u#00000000000000000000000000000000",
    branchMembershipId: null,
    taskConfirmDetails: false,
    taskSignAgreement: false,
    permission: "customer",
    localHashedPassword: null,
    vippsUserId: null,
    ...overrides,
  });
  return user;
}

/** A complete plain `User` for pure functions that never touch the database. */
export function userDto(overrides: Partial<UserDto> = {}): UserDto {
  return {
    id: fixtureId("c0"),
    name: "Kari Nordmann",
    email: "kari@example.com",
    phone: "90000000",
    address: "Testveien 1",
    postCode: "0150",
    postCity: "Oslo",
    emailConfirmed: true,
    dob: "2000-01-01",
    guardianName: null,
    guardianEmail: null,
    guardianPhone: null,
    blid: "u#00000000000000000000000000000000",
    branchMembershipId: null,
    taskConfirmDetails: false,
    taskSignAgreement: false,
    permission: "customer",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}
