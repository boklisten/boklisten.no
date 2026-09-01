import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { PasswordService } from "#services/password_service";
import { StorageService } from "#services/storage_service";
import type { User } from "#types/user";

export const UserService = {
  async getByUserDetailsId(detailsId: string | undefined): Promise<User | null> {
    try {
      const databaseQuery = new SEDbQuery();
      databaseQuery.stringFilters = [{ fieldName: "userDetail", value: detailsId ?? "" }];
      const [user] = await StorageService.Users.getByQuery(databaseQuery);
      return user ?? null;
    } catch {
      return null;
    }
  },
  async createLocalUser(detailsId: string, password: string) {
    return await StorageService.Users.add({
      userDetail: detailsId,
      permission: "customer",
      login: {
        local: {
          hashedPassword: await PasswordService.hash(password),
        },
      },
    });
  },
  async createVippsUser(detailsId: string, vippsUserId: string) {
    return await StorageService.Users.add({
      userDetail: detailsId,
      permission: "customer",
      login: { vipps: { userId: vippsUserId, lastLogin: new Date() } },
    });
  },
};
