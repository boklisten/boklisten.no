import "reflect-metadata";
import { Ignitor, prettyPrintError } from "@adonisjs/core";
import { dbAssertions } from "@adonisjs/lucid/plugins/db";
import { apiClient } from "@japa/api-client";
import { assert } from "@japa/assert";
import { pluginAdonisJS } from "@japa/plugin-adonisjs";
import { configure, processCLIArgs, run } from "@japa/runner";

const APP_ROOT = new URL("../", import.meta.url);
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
        plugins: [assert(), apiClient(), pluginAdonisJS(app), dbAssertions(app)],
        // The groups truncate after each test, so the first test would otherwise meet whatever
        // the migrations seeded: on a fresh database (CI), the real root branch, which the
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
          },
        ],
      });
    })
    .run(() => run());
} catch (error) {
  process.exitCode = 1;
  void prettyPrintError(error);
}
