await import("reflect-metadata");
const { Ignitor, prettyPrintError } = await import("@adonisjs/core");

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
    .httpServer()
    .start();
} catch (error) {
  process.exitCode = 1;
  void prettyPrintError(error);
}
