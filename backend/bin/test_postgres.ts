/**
 * A throwaway Postgres for one test run, started by `bin/test.ts` so the suite needs no database
 * server or Docker. It prints the connection URL once the database is ready and stops the cluster
 * when its stdin closes, which happens however the test process ends, even when it is killed.
 *
 * It runs in its own process because `embedded-postgres` installs process-wide exit hooks on
 * import; inside the test process they hold it open over ace's IPC channel and force exit code 0.
 */
import EmbeddedPostgres from "embedded-postgres";
import { once } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A port nothing listens on right now, picked by the OS. */
async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("A TCP server always has an address object");
  }
  server.close();
  await once(server, "close");
  return address.port;
}

const port = await freePort();
const postgres = new EmbeddedPostgres({
  // Deleted on stop (`persistent: false`)
  databaseDir: await mkdtemp(join(tmpdir(), "boklisten-test-pg-")),
  port,
  persistent: false,
  // Nothing here has to survive a crash
  postgresFlags: ["-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off"],
  onLog: () => {},
});
await postgres.initialise();
await postgres.start();
await postgres.createDatabase("boklisten_test");

process.stdin.once("end", () => {
  void postgres.stop().finally(() => process.exit(0));
  // `stop()` waits for the server's exit event, which never comes again if it already died
  setTimeout(() => process.exit(1), 10_000).unref();
});
process.stdin.resume();
process.stdout.write(`postgresql://postgres:password@localhost:${port}/boklisten_test\n`);
