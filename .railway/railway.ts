import {
  defineRailway,
  github,
  mongo,
  postgres,
  preserve,
  project,
  service,
  volume,
} from "railway/iac";

const REGION = "europe-west4-drams3a";
const MONOREPO = "boklisten/boklisten.no";

export default defineRailway((ctx) => {
  const isProduction = ctx.isEnvironment("production");
  const branch = isProduction ? "production" : "main";
  const host = (domain: string) => (isProduction ? domain : `staging.${domain}`);

  const postgresDb = postgres("Postgres", { region: REGION });
  const mongoDb = mongo("Mongo", { region: REGION });
  if (!isProduction) {
    postgresDb.networking = { tcpProxies: { "5432": {} } };
    mongoDb.networking = { tcpProxies: { "27017": {} } };
    mongoDb.deploy = { sleepApplication: true };
    // Do not sleep Postgres in staging to allow for migrations
  }

  const postgresVolume = volume("postgres-volume", { region: REGION, sizeMB: 50_000 });
  const mongodbVolume = volume("mongodb-volume", { region: REGION, sizeMB: 20_000 });

  const backend = service("api.boklisten.no", {
    source: github(MONOREPO, { branch, checkSuites: true }),
    build: "bun build:backend",
    preDeploy: "bun migrate:backend",
    start: "bun start:backend",
    healthcheck: "/health",
    deploy: { sleepApplication: !isProduction },
    replicas: { [REGION]: 1 },
    domains: [host("api.boklisten.no")],
    env: {
      HOST: "::",
      MONGODB_URI: mongoDb.env.MONGO_URL,
      POSTGRES_URL: postgresDb.env.DATABASE_URL,
      APP_KEY: preserve(),
      BRING_API_ID: preserve(),
      BRING_API_KEY: preserve(),
      SENDGRID_API_KEY: preserve(),
      SENDGRID_EMAIL_VALIDATION_API_KEY: preserve(),
      SENDGRID_WEBHOOK_PUBLIC_KEY: preserve(),
      TWILIO_SMS_AUTH_TOKEN: preserve(),
      TWILIO_SMS_SID: preserve(),
      VIPPS_CLIENT_ID: preserve(),
      VIPPS_MSN: preserve(),
      VIPPS_MT_CLIENT_ID: preserve(),
      VIPPS_MT_MSN: preserve(),
      VIPPS_MT_SECRET: preserve(),
      VIPPS_MT_SUBSCRIPTION_KEY: preserve(),
      VIPPS_SECRET: preserve(),
      VIPPS_SUBSCRIPTION_KEY: preserve(),
    },
  });

  const frontend = service("boklisten.no", {
    source: github(MONOREPO, { branch, checkSuites: true }),
    build: "bun build:frontend",
    start: "bun start:frontend",
    healthcheck: "/health",
    deploy: { sleepApplication: !isProduction },
    replicas: { [REGION]: 1 },
    domains: [host("boklisten.no")],
    env: {
      API_PRIVATE_DOMAIN: backend.env.RAILWAY_PRIVATE_DOMAIN,
      SENTRY_AUTH_TOKEN: ctx.shared.SENTRY_AUTH_TOKEN,
    },
  });

  type ServiceConfig = NonNullable<Parameters<typeof service>[1]>;
  const cronJob = (
    name: string,
    directory: string,
    { schedule, env }: { schedule: string; env: ServiceConfig["env"] },
  ) =>
    service(name, {
      source: github(MONOREPO, { branch, rootDirectory: `/cron_jobs/${directory}` }),
      build: { watchPatterns: [`/cron_jobs/${directory}/**`] },
      deploy: { cronSchedule: schedule, restartPolicyType: "NEVER" },
      replicas: { [REGION]: 1 },
      env,
    });

  const cronJobs = isProduction
    ? [
        cronJob("Database Cleanup", "database_cleanup", {
          schedule: "0 2 * * 1",
          env: { MONGO_URI: mongoDb.env.MONGO_URL },
        }),
        cronJob("Copy Postgres to Staging", "copy_prod_postgres_to_staging", {
          schedule: "0 4 * * *",
          env: {
            SOURCE_DATABASE_URL: postgresDb.env.DATABASE_URL,
            TARGET_DATABASE_URL: preserve(),
          },
        }),
        cronJob("Copy Mongo to Staging", "copy_prod_mongodb_to_staging", {
          schedule: "0 4 * * *",
          env: {
            FROM_MONGODB_URI: mongoDb.env.MONGO_URL,
            TO_MONGODB_URI: preserve(),
          },
        }),
      ]
    : [];

  return project("boklisten.no", {
    resources: [frontend, backend, postgresDb, mongoDb, postgresVolume, mongodbVolume, ...cronJobs],
  });
});
