import { Item } from "#shared/item";
import { StandMatch } from "#shared/match/stand-match";
import { UserMatch } from "#shared/match/user-match";
import { UserDetail } from "#shared/user-detail";

export type MatchRelevantUserDetails = Pick<UserDetail, "name" | "phone" | "email">;

export type MatchRelevantItemDetails = Pick<Item, "id" | "title">;

export type UserMatchWithDetails = UserMatch & {
  customerADetails: MatchRelevantUserDetails;
  customerBDetails: MatchRelevantUserDetails;
  blIdToItemMap: Record<string, string>;
  itemDetails: Record<string, MatchRelevantItemDetails>;
};

export type StandMatchWithDetails = StandMatch & {
  itemDetails: Record<string, MatchRelevantItemDetails>;
};

export type AdminUserMatchWithDetails = UserMatchWithDetails;

export type AdminStandMatchWithDetails = StandMatchWithDetails & {
  customerDetails: MatchRelevantUserDetails;
};
