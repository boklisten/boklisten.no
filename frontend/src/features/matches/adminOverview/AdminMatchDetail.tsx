import type {
  AdminStandMatchWithDetails,
  UserMatchWithDetails,
} from "@boklisten/backend/shared/match/match-dtos";

import AdminStandMatchDetail from "@/features/matches/adminOverview/AdminStandMatchDetail";
import AdminUserMatchDetail from "@/features/matches/adminOverview/AdminUserMatchDetail";

export default function AdminMatchDetail({
  userMatch,
  standMatch,
}: {
  userMatch?: UserMatchWithDetails | undefined;
  standMatch?: AdminStandMatchWithDetails | undefined;
}) {
  if (userMatch) return <AdminUserMatchDetail userMatch={userMatch} />;
  if (standMatch) return <AdminStandMatchDetail standMatch={standMatch} />;
  return null;
}
