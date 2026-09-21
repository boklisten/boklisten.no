/**
 * How coarsely a user's last activity is kept: an authenticated request refreshes
 * `User.lastActiveAt` only when the stored one is at least this old (see `LoginService`), so a
 * stamp younger than this means "active some time in the last ten minutes", not an exact moment.
 */
export const ACTIVITY_RESOLUTION_MINUTES = 10;
