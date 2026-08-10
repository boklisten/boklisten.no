// mulberry32 PRNG: https://stackoverflow.com/a/47593316
import {
  CandidateStandMatch,
  CandidateUserMatch,
  MatchableUser,
} from "#services/match_helpers/match-finder/match-types";

export function seededRandom(seed: number) {
  return function () {
    let t = (seed += 0x6d_2b_79_f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createFakeUserMatch(
  customerA: MatchableUser,
  customerB: MatchableUser,
  AToBItems: string[] | Set<string>,
  BToAItems?: string[] | Set<string>,
): CandidateUserMatch {
  return {
    customerA: customerA.id,
    customerB: customerB.id,
    expectedAToBItems: new Set(AToBItems),
    expectedBToAItems: new Set(BToAItems),
  };
}

export function createFakeStandMatch(
  user: MatchableUser,
  expectedPickupItems: Set<string>,
  expectedHandoffItems: Set<string>,
): CandidateStandMatch {
  return {
    customer: user.id,
    expectedPickupItems,
    expectedHandoffItems,
  };
}

export function createFakeMatchableUser(
  id: string,
  items: string[],
  wantedItems?: string[],
  groupMembership?: string,
): MatchableUser {
  return {
    id,
    items: new Set(items),
    wantedItems: new Set(wantedItems ?? []),
    groupMembership: groupMembership ?? "unknown",
  };
}

export function createUserGroup(
  idSuffix: string,
  size: number,
  items: string[],
  wantedItems: string[],
  membership?: string,
): MatchableUser[] {
  return Array.from({ length: size }, (_, id) =>
    createFakeMatchableUser(id + idSuffix, items, wantedItems, membership),
  );
}

// in place shuffle with seed, Fisher-Yates
export const shuffler =
  (randomizer: () => number) =>
  <T>(list: T[]): T[] => {
    for (let index = 0; index < list.length; index++) {
      const random = index + Math.floor(randomizer() * (list.length - index));
      const temporary = list[random];
      list[random] = list[index]!;
      list[index] = temporary!;
    }
    return list;
  };

export function createMatchableUsersWithIdSuffix(
  rawData: { id: string; items: { $numberLong: string }[] }[],
  isSender: boolean,
): MatchableUser[] {
  return rawData.map(({ id, items }) => {
    const processedItems = new Set(items.map((item) => item["$numberLong"]));
    return {
      id: id + (isSender ? "_sender" : "_receiver"),
      items: isSender ? processedItems : new Set(),
      wantedItems: isSender ? new Set() : processedItems,
      groupMembership: "unknown",
    };
  });
}
