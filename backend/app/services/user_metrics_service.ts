import { BlError } from "#shared/bl-error";
import { StorageService } from "#services/storage_service";

const DAY_MS = 24 * 60 * 60 * 1000;

export type LoginMethod = "vipps" | "local" | "both" | "none";

export const ACTIVITY_BUCKETS = [
  "last24Hours",
  "lastWeek",
  "lastMonth",
  "lastQuarter",
  "lastYear",
  "overAYear",
  "never",
] as const;

export type ActivityBucket = (typeof ACTIVITY_BUCKETS)[number];

const BUCKET_MAX_AGE_DAYS: { bucket: ActivityBucket; maxAgeDays: number }[] = [
  { bucket: "last24Hours", maxAgeDays: 1 },
  { bucket: "lastWeek", maxAgeDays: 7 },
  { bucket: "lastMonth", maxAgeDays: 30 },
  { bucket: "lastQuarter", maxAgeDays: 90 },
  { bucket: "lastYear", maxAgeDays: 365 },
];

export interface UserMetrics {
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
  id: { method: LoginMethod; bucket: ActivityBucket };
  count: number;
}

interface RegistrationFacets {
  total: { count: number }[];
  last30Days: { count: number }[];
  lastYear: { count: number }[];
  byMonth: { id: string; count: number }[];
}

async function aggregateActivity(): Promise<ActivityRow[]> {
  const now = Date.now();
  // oxlint-disable no-thenable -- MongoDB $switch branches require `then` keys
  return StorageService.Users.aggregate<ActivityRow>([
    {
      $project: {
        hasVipps: { $gt: ["$login.vipps.userId", null] },
        hasLocal: { $gt: ["$login.local.hashedPassword", null] },
        lastActive: "$login.lastTokenIssuedAt",
      },
    },
    {
      $project: {
        method: {
          $switch: {
            branches: [
              { case: { $and: ["$hasVipps", "$hasLocal"] }, then: "both" },
              { case: "$hasVipps", then: "vipps" },
              { case: "$hasLocal", then: "local" },
            ],
            default: "none",
          },
        },
        bucket: {
          $switch: {
            branches: [
              { case: { $eq: [{ $ifNull: ["$lastActive", null] }, null] }, then: "never" },
              ...BUCKET_MAX_AGE_DAYS.map(({ bucket, maxAgeDays }) => ({
                case: { $gte: ["$lastActive", new Date(now - maxAgeDays * DAY_MS)] },
                then: bucket,
              })),
            ],
            default: "overAYear",
          },
        },
      },
    },
    { $group: { _id: { method: "$method", bucket: "$bucket" }, count: { $sum: 1 } } },
  ]);
  // oxlint-enable no-thenable
}

async function aggregateRegistrations(): Promise<RegistrationFacets> {
  const now = Date.now();
  const [facets] = await StorageService.UserDetails.aggregate<RegistrationFacets>([
    {
      $facet: {
        total: [{ $count: "count" }],
        last30Days: [
          { $match: { creationTime: { $gte: new Date(now - 30 * DAY_MS) } } },
          { $count: "count" },
        ],
        lastYear: [
          { $match: { creationTime: { $gte: new Date(now - 365 * DAY_MS) } } },
          { $count: "count" },
        ],
        byMonth: [
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m", date: "$creationTime", onNull: "unknown" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);
  if (!facets) {
    throw new BlError("registration aggregation returned nothing");
  }
  return facets;
}

function sumCounts(rows: ActivityRow[], matches: (row: ActivityRow) => boolean) {
  return rows.filter(matches).reduce((sum, row) => sum + row.count, 0);
}

async function getMetrics(): Promise<UserMetrics> {
  const [activityRows, registrations] = await Promise.all([
    aggregateActivity(),
    aggregateRegistrations(),
  ]);

  const loginMethods = {
    vipps: sumCounts(activityRows, (r) => r.id.method === "vipps"),
    local: sumCounts(activityRows, (r) => r.id.method === "local"),
    both: sumCounts(activityRows, (r) => r.id.method === "both"),
    none: sumCounts(activityRows, (r) => r.id.method === "none"),
  };

  const activeWithin = (buckets: ActivityBucket[]) =>
    sumCounts(activityRows, (r) => buckets.includes(r.id.bucket));

  // Months with unknown creationTime are folded into the starting total instead of the timeline
  const knownMonths = registrations.byMonth.filter((row) => row.id !== "unknown");
  const unknownCount = registrations.byMonth.find((row) => row.id === "unknown")?.count ?? 0;
  let runningTotal = unknownCount;
  const registrationsByMonth = knownMonths.map((row) => {
    runningTotal += row.count;
    return { month: row.id, newUsers: row.count, totalUsers: runningTotal };
  });

  return {
    totalUsers: registrations.total[0]?.count ?? 0,
    newLast30Days: registrations.last30Days[0]?.count ?? 0,
    newLastYear: registrations.lastYear[0]?.count ?? 0,
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
