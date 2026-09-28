/**
 * Deadlines are calendar days in `YYYY-MM-DD` form (Postgres `date` columns): a book is due by the
 * end of its deadline day, Norwegian time. Days in this form sort and compare correctly as strings.
 */

/**
 * Whether the deadline day has ended by `today` (`YYYY-MM-DD`, Norwegian time). Shared so the
 * warning the employee sees and the report the administrator gets follow the same rule.
 */
export function isDeadlineOverdue(deadline: string, today: string): boolean {
  return deadline < today;
}
