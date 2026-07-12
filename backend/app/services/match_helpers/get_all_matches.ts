import {
  addDetailsToUserMatches,
  getUserDetailsMap,
  mapItemIdsToItemDetails,
  selectMatchRelevantUserDetails,
} from "#services/match_helpers/get_my_matches";
import { StorageService } from "#services/storage_service";
import { AdminStandMatchWithDetails } from "#shared/match/match-dtos";
import { StandMatch } from "#shared/match/stand-match";
import { UserMatch } from "#shared/match/user-match";

async function addAdminDetailsToStandMatches(
  standMatches: StandMatch[],
): Promise<AdminStandMatchWithDetails[]> {
  const customerIds = Array.from(new Set(standMatches.map((standMatch) => standMatch.customer)));
  const itemIds = Array.from(
    new Set(
      standMatches.flatMap((standMatch) =>
        [
          standMatch.expectedHandoffItems,
          standMatch.expectedPickupItems,
          standMatch.deliveredItems,
          standMatch.receivedItems,
        ].flat(),
      ),
    ),
  );

  const [userDetailsMap, itemsMap] = await Promise.all([
    getUserDetailsMap(customerIds),
    StorageService.Items.getMany(itemIds).then(
      (items) => new Map(items.map((item) => [item.id, item])),
    ),
  ]);

  return standMatches.map((standMatch) => ({
    ...standMatch,
    customerDetails: selectMatchRelevantUserDetails(userDetailsMap.get(standMatch.customer)),
    itemDetails: mapItemIdsToItemDetails(
      [
        standMatch.expectedHandoffItems,
        standMatch.expectedPickupItems,
        standMatch.deliveredItems,
        standMatch.receivedItems,
      ].flat(),
      itemsMap,
    ),
  }));
}

export async function getAllMatches() {
  const [userMatches, standMatches] = (await Promise.all([
    StorageService.UserMatches.aggregate([{ $match: {} }]),
    StorageService.StandMatches.aggregate([{ $match: {} }]),
  ])) as [UserMatch[], StandMatch[]];

  const [userMatchesWithDetails, standMatchesWithDetails] = await Promise.all([
    addDetailsToUserMatches(userMatches),
    addAdminDetailsToStandMatches(standMatches),
  ]);

  return {
    userMatches: userMatchesWithDetails,
    standMatches: standMatchesWithDetails,
  };
}
