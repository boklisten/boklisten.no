import type { HttpContext } from "@adonisjs/core/http";
import { DateTime } from "luxon";

import User from "#models/user";
import { ACTIVITY_RESOLUTION_MINUTES } from "#shared/user-activity";

/**
 * Written past the model: being active is not an edit, so `updatedAt` must stay, and a dirty
 * attribute would ride along with whichever `save()` the request does next.
 */
async function stampActivity(userId: string): Promise<void> {
  await User.query().where("id", userId).update({ lastActiveAt: DateTime.now() });
}

export const LoginService = {
  /**
   * Starts the session for a user whose credentials the caller has verified, and remembers them
   * across the session's two-hour idle limit.
   */
  async login(ctx: HttpContext, user: User): Promise<void> {
    await stampActivity(user.id);
    await ctx.auth.use().login(user, true);
    // Lets every session of the user be found and ended at once (SessionRevocationService).
    await ctx.session.tag(user.id);
  },

  /**
   * Bookkeeping for an authenticated request, once the guard has run. The user's last activity
   * is refreshed when the stored one is older than the resolution, and a session the remember-me
   * cookie has just restored is tagged: the guard starts a fresh session for such a restore
   * without tagging it, and an untagged session would outlive `SessionRevocationService.revokeAll`
   * until it expired.
   */
  async trackActivity(ctx: HttpContext): Promise<void> {
    const guard = ctx.auth.use();
    const user = guard.getUserOrFail();
    if (guard.viaRemember) {
      await ctx.session.tag(user.id);
    }
    const threshold = DateTime.now().minus({ minutes: ACTIVITY_RESOLUTION_MINUTES });
    if ((user.lastActiveAt?.toMillis() ?? 0) <= threshold.toMillis()) {
      await stampActivity(user.id);
    }
  },
};
