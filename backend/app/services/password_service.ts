import hash from "@adonisjs/core/services/hash";

import type User from "#models/user";

export const PasswordService = {
  async hash(text: string) {
    return hash.make(text);
  },
  async setPassword(user: User, password: string) {
    user.localHashedPassword = await this.hash(password);
    await user.save();
  },
};
