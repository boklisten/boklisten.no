import db from "@adonisjs/lucid/services/db";

/**
 * Ends every login of a user on every device: the sessions tagged with their id and their
 * remember-me tokens. Used when the password is reset or the permission level changes, so a
 * demoted employee loses access at once rather than when their cookie expires.
 *
 * Both tables are deleted from directly: `SessionCollection.tagged()` drops rows whose payload
 * fails verification, and a login must end even when its row is damaged.
 */
export const SessionRevocationService = {
  async revokeAll(userId: string): Promise<void> {
    await Promise.all([
      db.from("sessions").where("user_id", userId).delete(),
      db.from("remember_me_tokens").where("tokenable_id", userId).delete(),
    ]);
  },
};
