import type { User } from "@boklisten/backend/shared/user";

type UserTasks = Pick<User, "taskConfirmDetails" | "taskSignAgreement">;

export function hasPendingTasks(user: UserTasks | null | undefined): boolean {
  return countPendingTasks(user) > 0;
}

export function countPendingTasks(user: UserTasks | null | undefined): number {
  return (user?.taskConfirmDetails ? 1 : 0) + (user?.taskSignAgreement ? 1 : 0);
}
