const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a loan deadline has passed. The deadline day itself and the day after are not counted,
 * matching the old bl-admin's `moment().isAfter(moment(deadline).add(1, "day"))`. Shared so the
 * warning the employee sees and the report the administrator gets follow the same rule.
 */
export function isDeadlineOverdue(deadline: Date | string, now: Date): boolean {
  return now.getTime() > new Date(deadline).getTime() + ONE_DAY_MS;
}
