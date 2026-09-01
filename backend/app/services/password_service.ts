import hash from "@adonisjs/core/services/hash";

import { StorageService } from "#services/storage_service";

export const PasswordService = {
  async hash(text: string) {
    return hash.make(text);
  },
  async setPassword(userId: string, password: string) {
    await StorageService.Users.update(userId, {
      $set: {
        "login.local.hashedPassword": await this.hash(password),
      },
    });
  },
};
