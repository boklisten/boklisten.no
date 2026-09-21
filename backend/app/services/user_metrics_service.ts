import db from "@adonisjs/lucid/services/db";

const DAY_MS = 24 * 60 * 60 * 1000;

type LoginMethod = "vipps" | "local" | "both" | "none";

const ACTIVITY_BUCKETS = [
  "last24Hours",
  "lastWeek",
  "lastMonth",
  "lastQuarter",
  "lastYear",
  "overAYear",
  "never",
] as const;

type ActivityBucket = (typeof ACTIVITY_BUCKETS)[number];

const BUCKET_MAX_AGE_DAYS: { bucket: ActivityBucket; maxAgeDays: number }[] = [
  { bucket: "last24Hours", maxAgeDays: 1 },
  { bucket: "lastWeek", maxAgeDays: 7 },
  { bucket: "lastMonth", maxAgeDays: 30 },
  { bucket: "lastQuarter", maxAgeDays: 90 },
  { bucket: "lastYear", maxAgeDays: 365 },
];

interface UserMetrics {
  totalUsers: number;
  newLast30Days: number;
  newLastYear: number;
  activeLast24Hours: number;
  activeLast30Days: number;
  activeLastYear: number;
  registrationsByMonth: { month: string; newUsers: number; totalUsers: number }[];
  loginMethods: Record<LoginMethod, number>;
}

interface ActivityRow {
  method: LoginMethod;
  bucket: ActivityBucket;
  count: number;
}

/** Users counted per login method and per how recently they were last active. */
async function aggregateActivity(now: number): Promise<ActivityRow[]> {
  const bucketCases = BUCKET_MAX_AGE_DAYS.map(
    ({ bucket }) => `WHEN last_active_at >= ? THEN '${bucket}'`,
  ).join(" ");
  const bucketBindings = BUCKET_MAX_AGE_DAYS.map(
    ({ maxAgeDays }) => new Date(now - maxAgeDays * DAY_MS),
  );
  const result = await db.rawQuery<{
    rows: { method: LoginMethod; bucket: ActivityBucket; count: string }[];
  }>(
    `SELECT
       CASE
         WHEN vipps_user_id IS NOT NULL AND local_hashed_password IS NOT NULL THEN 'both'
         WHEN vipps_user_id IS NOT NULL THEN 'vipps'
         WHEN local_hashed_password IS NOT NULL THEN 'local'
         ELSE 'none'
       END AS method,
       CASE
         WHEN last_active_at IS NULL THEN 'never'
         ${bucketCases}
         ELSE 'overAYear'
       END AS bucket,
       count(*) AS count
     FROM users
     GROUP BY 1, 2`,
    bucketBindings,
  );
  return result.rows.map(({ count, ...row }) => Object.assign(row, { count: Number(count) }));
}

async function aggregateRegistrations(now: number) {
  const [totals, byMonth] = await Promise.all([
    db.rawQuery<{ rows: { total: string; last30days: string; lastyear: string }[] }>(
      `SELECT
         count(*) AS total,
         count(*) FILTER (WHERE created_at >= ?) AS last30days,
         count(*) FILTER (WHERE created_at >= ?) AS lastyear
       FROM users`,
      [new Date(now - 30 * DAY_MS), new Date(now - 365 * DAY_MS)],
    ),
    db.rawQuery<{ rows: { month: string; count: string }[] }>(
      `SELECT to_char(created_at AT TIME ZONE 'Europe/Oslo', 'YYYY-MM') AS month, count(*) AS count
       FROM users
       GROUP BY 1
       ORDER BY 1`,
    ),
  ]);
  const [facets] = totals.rows;
  return {
    total: Number(facets?.total ?? 0),
    last30Days: Number(facets?.last30days ?? 0),
    lastYear: Number(facets?.lastyear ?? 0),
    byMonth: byMonth.rows.map((row) => ({ month: row.month, count: Number(row.count) })),
  };
}

function sumCounts(rows: ActivityRow[], matches: (row: ActivityRow) => boolean) {
  return rows.filter(matches).reduce((sum, row) => sum + row.count, 0);
}

async function getMetrics(): Promise<UserMetrics> {
  const now = Date.now();
  const [activityRows, registrations] = await Promise.all([
    aggregateActivity(now),
    aggregateRegistrations(now),
  ]);

  const loginMethods = {
    vipps: sumCounts(activityRows, (r) => r.method === "vipps"),
    local: sumCounts(activityRows, (r) => r.method === "local"),
    both: sumCounts(activityRows, (r) => r.method === "both"),
    none: sumCounts(activityRows, (r) => r.method === "none"),
  };

  const activeWithin = (buckets: ActivityBucket[]) =>
    sumCounts(activityRows, (r) => buckets.includes(r.bucket));

  let runningTotal = 0;
  const registrationsByMonth = registrations.byMonth.map((row) => {
    runningTotal += row.count;
    return { month: row.month, newUsers: row.count, totalUsers: runningTotal };
  });

  return {
    totalUsers: registrations.total,
    newLast30Days: registrations.last30Days,
    newLastYear: registrations.lastYear,
    activeLast24Hours: activeWithin(["last24Hours"]),
    activeLast30Days: activeWithin(["last24Hours", "lastWeek", "lastMonth"]),
    activeLastYear: activeWithin([
      "last24Hours",
      "lastWeek",
      "lastMonth",
      "lastQuarter",
      "lastYear",
    ]),
    registrationsByMonth,
    loginMethods,
  };
}

export const UserMetricsService = {
  getMetrics,
};
