import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";
import type { ProjectResourceInput } from "railway/iac";

const REGION = "europe-west4-drams3a";
const MONOREPO = "boklisten/boklisten.no";

export default defineRailway((ctx) => {
  const isProduction = ctx.isEnvironment("production");
  const branch = isProduction ? "production" : "main";
  const host = (domain: string) => (isProduction ? domain : `staging.${domain}`);

  const postgresDb = postgres("Postgres", { region: REGION });
  if (!isProduction) {
    postgresDb.networking = { tcpProxies: { "5432": {} } };
    // Do not sleep Postgres in staging to allow for migrations
  }

  const postgresVolume = volume("postgres-volume", { region: REGION, sizeMB: 50_000 });

  const backend = service("api.boklisten.no", {
    source: github(MONOREPO, { branch }),
    build: "bun build:backend",
    preDeploy: "bun migrate:backend",
    start: "bun start:backend",
    healthcheck: "/health",
    deploy: { sleepApplication: !isProduction },
    replicas: { [REGION]: 1 },
    domains: [host("api.boklisten.no")],
    env: {
      HOST: "::",
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
    source: github(MONOREPO, { branch }),
    build: "bun build:frontend",
    start: "bun start:frontend",
    healthcheck: "/health",
    deploy: { sleepApplication: !isProduction },
    replicas: { [REGION]: 1 },
    domains: [host("boklisten.no")],
    env: {
      API_PRIVATE_URL: "http://apiboklisten.railway.internal:8080",
      SENTRY_AUTH_TOKEN: ctx.shared.SENTRY_AUTH_TOKEN,
    },
  });

  const resources: ProjectResourceInput[] = [frontend, backend, postgresDb, postgresVolume];
  if (isProduction) {
    resources.push(
      service("Copy Postgres to Staging", {
        source: github(MONOREPO, {
          branch,
          rootDirectory: "/cron_jobs/copy_prod_postgres_to_staging",
        }),
        build: { watchPatterns: ["/cron_jobs/copy_prod_postgres_to_staging/**"] },
        deploy: { cronSchedule: "0 4 * * *", restartPolicyType: "NEVER" },
        replicas: { [REGION]: 1 },
        env: {
          SOURCE_DATABASE_URL: postgresDb.env.DATABASE_URL,
          TARGET_DATABASE_URL: preserve(),
        },
      }),
    );
  }

  return project("boklisten.no", { resources });
});
