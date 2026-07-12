import { ObjectId } from "mongodb";

import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { Item } from "#shared/item";
import {
  MatchRelevantItemDetails,
  MatchRelevantUserDetails,
  StandMatchWithDetails,
  UserMatchWithDetails,
} from "#shared/match/match-dtos";
import { StandMatch } from "#shared/match/stand-match";
import { UserMatch } from "#shared/match/user-match";
import { UserDetail } from "#shared/user-detail";

export function selectMatchRelevantUserDetails(userDetail?: UserDetail): MatchRelevantUserDetails {
  return {
    name: userDetail?.name ?? "",
    phone: userDetail?.phone ?? "",
    email: userDetail?.email ?? "",
  };
}

function mapBlIdsToItemIds(
  blIds: string[],
  blIdsToItemIdsMap: Map<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    blIds.map(String).map((blId) => {
      const itemId = blIdsToItemIdsMap.get(blId);
      if (itemId === undefined) {
        throw new BlError(`No uniqueitem with id ${blId} found`);
      }
      return [blId, itemId];
    }),
  );
}

export function mapItemIdsToItemDetails(
  itemIds: string[],
  itemsMap: Map<string, Item>,
): Record<string, MatchRelevantItemDetails> {
  return Object.fromEntries(
    [...new Set(itemIds.map(String))].map((itemId) => {
      const item = itemsMap.get(itemId);
      if (item === undefined) {
        throw new BlError(`No item found with id ${itemId} when detailing match`);
      }
      const details: MatchRelevantItemDetails = {
        id: itemId,
        title: item.title,
      };
      return [itemId, details];
    }),
  );
}

function addDetailsToMatch(
  userMatch: UserMatch,
  detailsMap: Map<string, UserDetail>,
  blIdsToItemIdMap: Map<string, string>,
  itemsMap: Map<string, Item>,
): UserMatchWithDetails {
  const customerADetails = detailsMap.get(userMatch.customerA);
  const customerBDetails = detailsMap.get(userMatch.customerB);

  const blIds = Array.from(
    new Set(
      [
        userMatch.deliveredBlIdsCustomerA,
        userMatch.deliveredBlIdsCustomerB,
        userMatch.receivedBlIdsCustomerA,
        userMatch.receivedBlIdsCustomerB,
      ].flat(),
    ),
  );

  return {
    ...userMatch,
    customerADetails: selectMatchRelevantUserDetails(customerADetails),
    customerBDetails: selectMatchRelevantUserDetails(customerBDetails),
    blIdToItemMap: mapBlIdsToItemIds(blIds, blIdsToItemIdMap),
    itemDetails: mapItemIdsToItemDetails(
      [userMatch.expectedAToBItems, userMatch.expectedBToAItems].flat(),
      itemsMap,
    ),
  };
}

// Aggregate rather than getMany so inactive user details are still returned (getMany filters active).
export async function getUserDetailsMap(customerIds: string[]): Promise<Map<string, UserDetail>> {
  if (customerIds.length === 0) return new Map();
  const userDetails = (await StorageService.UserDetails.aggregate([
    { $match: { _id: { $in: customerIds.map((id) => new ObjectId(id)) } } },
  ])) as UserDetail[];
  return new Map(userDetails.map((detail) => [detail.id, detail]));
}

async function getBlIdToItemIdMap(blIds: string[]): Promise<Map<string, string>> {
  const blIdToItemIdMap = new Map(blIds.map((blId): [string, string] => [blId, ""]));
  if (blIds.length === 0) return blIdToItemIdMap;
  const uniqueItems = (await StorageService.UniqueItems.aggregate([
    { $match: { blid: { $in: blIds } } },
  ])) as { blid: string; item?: string }[];
  for (const uniqueItem of uniqueItems) {
    blIdToItemIdMap.set(uniqueItem.blid, uniqueItem.item ?? "");
  }
  return blIdToItemIdMap;
}

export async function addDetailsToUserMatches(
  userMatches: UserMatch[],
): Promise<UserMatchWithDetails[]> {
  const customerIds = Array.from(
    new Set(userMatches.flatMap((userMatch) => [userMatch.customerA, userMatch.customerB])),
  );

  const blIds = Array.from(
    new Set(
      userMatches.flatMap((userMatch) =>
        [
          userMatch.deliveredBlIdsCustomerA,
          userMatch.deliveredBlIdsCustomerB,
          userMatch.receivedBlIdsCustomerA,
          userMatch.receivedBlIdsCustomerB,
        ].flat(),
      ),
    ),
  );

  const expectedItemIds = userMatches.flatMap((userMatch) =>
    [userMatch.expectedAToBItems, userMatch.expectedBToAItems].flat(),
  );

  const [userDetailsMap, blIdsToItemIdMap] = await Promise.all([
    getUserDetailsMap(customerIds),
    getBlIdToItemIdMap(blIds),
  ]);

  const allItemIds = Array.from(
    new Set([...expectedItemIds, ...blIdsToItemIdMap.values()].filter(Boolean)),
  );
  const itemsMap = new Map(
    (await StorageService.Items.getMany(allItemIds)).map((item) => [item.id, item]),
  );

  return userMatches.map((userMatch) =>
    addDetailsToMatch(userMatch, userDetailsMap, blIdsToItemIdMap, itemsMap),
  );
}

async function addDetailsToStandMatch(standMatch: StandMatch): Promise<StandMatchWithDetails> {
  const items = Array.from(
    new Set(
      [
        standMatch.expectedHandoffItems,
        standMatch.expectedPickupItems,
        standMatch.deliveredItems,
        standMatch.receivedItems,
      ].flat(),
    ),
  );

  const itemsMap = new Map(
    (await StorageService.Items.getMany(items)).map((item) => [item.id, item]),
  );
  return {
    ...standMatch,
    itemDetails: mapItemIdsToItemDetails(items, itemsMap),
  };
}

export async function getMatches(detailsId: string) {
  const userMatches = (await StorageService.UserMatches.aggregate([
    {
      $match: {
        $or: [{ customerA: new ObjectId(detailsId) }, { customerB: new ObjectId(detailsId) }],
      },
    },
  ])) as UserMatch[];

  const userMatchesWithDetails = await addDetailsToUserMatches(userMatches);

  const standMatches = (await StorageService.StandMatches.aggregate([
    {
      $match: {
        customer: new ObjectId(detailsId),
      },
    },
  ])) as StandMatch[];

  const standMatch = standMatches[0];
  const standMatchWithDetails = standMatch && (await addDetailsToStandMatch(standMatch));

  return {
    userMatches: userMatchesWithDetails,
    standMatch: standMatchWithDetails,
  };
}
