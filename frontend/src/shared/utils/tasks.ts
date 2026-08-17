import type { UserDetail } from "@boklisten/backend/shared/user-detail";

export function hasPendingTasks(userDetail: Pick<UserDetail, "tasks"> | null | undefined) {
  return (userDetail?.tasks?.confirmDetails || userDetail?.tasks?.signAgreement) ?? false;
}
