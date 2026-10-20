import "reflect-metadata";
import { Ignitor, prettyPrintError } from "@adonisjs/core";
import { dbAssertions } from "@adonisjs/lucid/plugins/db";
import { apiClient } from "@japa/api-client";
import { assert } from "@japa/assert";
import { pluginAdonisJS } from "@japa/plugin-adonisjs";
import { configure, processCLIArgs, run } from "@japa/runner";
import type { PluginFn } from "@japa/runner/types";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { restore } from "sinon";

const APP_ROOT = new URL("../", import.meta.url);

/** Starts `bin/test_postgres.ts` and points `POSTGRES_URL` at the database it reports. */
async function startTestPostgres() {
  const child = spawn(
    process.execPath,
    [
      // The TypeScript loader, but not debugger flags: `--inspect-brk` would pause the helper
      // before it reports, and `--inspect` would fight this process for the inspector port
      ...process.execArgv.filter((arg) => !arg.startsWith("--inspect")),
      fileURLToPath(new URL("test_postgres.ts", import.meta.url)),
    ],
    { stdio: ["pipe", "pipe", "inherit"] },
  );
  const url = await Promise.race([
    once(createInterface({ input: child.stdout }), "line").then(([line]) => String(line)),
    once(child, "exit").then(() => null),
  ]);
  if (url === null) {
    throw new Error("The test Postgres exited before it was ready");
  }
  process.env["POSTGRES_URL"] = url;
  return child;
}

// An explicit POSTGRES_URL (CI's Postgres service) wins; otherwise the suite brings its own
// database. It has to be up before the app boots, since boot validates the env.
const testPostgres = process.env["POSTGRES_URL"] ? null : await startTestPostgres();

/**
 * Undoes every stub or spy made through sinon's default sandbox once a test has ended, so specs
 * never restore their own. `test:end` comes after the teardown hooks and also when a setup hook
 * failed, so no stub outlives its test.
 */
const restoreSinon: PluginFn = ({ emitter }) => {
  emitter.on("test:end", () => restore());
};

const IMPORTER = (filePath: string) => {
  if (filePath.startsWith("./") || filePath.startsWith("../")) {
    return import(new URL(filePath, APP_ROOT).href);
  }
  return import(filePath);
};

try {
  await new Ignitor(APP_ROOT, { importer: IMPORTER })
    .tap((app) => {
      app.booting(async () => {
        await import("#start/env");
      });
      app.listen("SIGTERM", () => app.terminate());
      app.listenIf(app.managedByPm2, "SIGINT", () => app.terminate());
    })
    .testRunner()
    .configure(async (app) => {
      processCLIArgs(process.argv.splice(2));
      configure({
        ...app.rcFile.tests,
        plugins: [assert(), apiClient(), pluginAdonisJS(app), dbAssertions(app), restoreSinon],
        // Runs the migrations, then empties what they seeded: the groups only undo their own
        // writes, so the first test would otherwise meet the real root branch, which the
        // single-root index lets the fixture root (`rootBranch`) be silently ignored beside.
        setup: [
          async () => {
            const { default: testUtils } = await import("@adonisjs/core/services/test_utils");
            const truncate = await testUtils.db().truncate();
            await truncate();
          },
        ],
        teardown: [
          async () => {
            const { default: db } = await import("@adonisjs/lucid/services/db");
            await db.manager.closeAll();
            if (testPostgres) {
              const exited = testPostgres.exitCode !== null || testPostgres.signalCode !== null;
              testPostgres.stdin.end();
              if (!exited) {
                await once(testPostgres, "exit");
              }
            }
          },
        ],
      });
    })
    .run(() => run());
} catch (error) {
  process.exitCode = 1;
  void prettyPrintError(error);
  // A failed boot never reaches the teardown, and the open pipe would keep this process alive
  testPostgres?.stdin.end();
}
