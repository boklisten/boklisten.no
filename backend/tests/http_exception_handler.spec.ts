import { HttpContextFactory } from "@adonisjs/core/factories/http";
import { errors } from "@adonisjs/core/http";
import { test } from "@japa/runner";
import * as Sentry from "@sentry/node";

import HttpExceptionHandler from "#exceptions/handler";

/**
 * Sentry is never initialised under API_ENV=test (see start/instrument.ts), so stand up a
 * throwaway client whose beforeSend records what the handler forwarded and then drops it.
 * Returning null keeps the event off the wire.
 */
function recordEventsSentToSentry(): string[] {
  const captured: string[] = [];

  Sentry.init({
    dsn: "https://public@o0.ingest.sentry.io/0",
    enabled: true,
    defaultIntegrations: false,
    beforeSend(event) {
      captured.push(event.exception?.values?.[0]?.value ?? "");
      return null;
    },
  });

  return captured;
}

test.group("HttpExceptionHandler.report()", (group) => {
  group.each.teardown(async () => {
    await Sentry.close();
  });

  test("does not forward route-not-found errors to Sentry", async ({ assert }) => {
    const captured = recordEventsSentToSentry();

    await new HttpExceptionHandler().report(
      new errors.E_ROUTE_NOT_FOUND(["GET", "/.env"]),
      new HttpContextFactory().create(),
    );
    await Sentry.flush(2000);

    assert.deepEqual(captured, []);
  });

  test("forwards unexpected server errors to Sentry", async ({ assert }) => {
    const captured = recordEventsSentToSentry();

    await new HttpExceptionHandler().report(
      new Error("database exploded"),
      new HttpContextFactory().create(),
    );
    await Sentry.flush(2000);

    assert.deepEqual(captured, ["database exploded"]);
  });
});
