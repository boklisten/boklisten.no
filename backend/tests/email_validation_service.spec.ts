import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import {
  EmailValidationService,
  SENDGRID_EMAIL_VALIDATION_URL,
} from "#services/email_validation_service";
import env from "#start/env";
import { unchecked } from "#tests/test-doubles";

const SENDGRID_RESULT = {
  result: {
    email: "solan@gmail.con",
    verdict: "Invalid",
    score: 0,
    local: "solan",
    host: "gmail.con",
    suggestion: "gmail.com",
    checks: {
      domain: {
        has_valid_address_syntax: true,
        has_mx_or_a_record: false,
        is_suspected_disposable_address: false,
      },
      local_part: { is_suspected_role_address: false },
      additional: { has_known_bounces: false, has_suspected_bounces: true },
    },
    source: "SIGNUP",
    ip_address: "10.0.0.1",
  },
};

function jsonResponse(status: number, body: unknown) {
  return Response.json(body, { status });
}

test.group("EmailValidationService.check", (group) => {
  let sandbox: sinon.SinonSandbox;
  let fetchStub: sinon.SinonStub;

  function withApiKey(apiKey: string | undefined) {
    const originalGet = env.get.bind(env);
    sandbox
      .stub(env, "get")
      .callsFake(
        unchecked((key: string) =>
          key === "SENDGRID_EMAIL_VALIDATION_API_KEY" ? apiKey : originalGet(unchecked(key)),
        ),
      );
  }

  group.each.setup(() => {
    sandbox = createSandbox();
    fetchStub = sandbox.stub(globalThis, "fetch");
  });
  group.each.teardown(() => sandbox.restore());

  test("without a validation key it reports unavailable and never calls SendGrid", async ({
    assert,
  }) => {
    withApiKey(undefined);

    const result = await EmailValidationService.check("solan@gmail.com", "signup");

    assert.deepEqual(result, { available: false });
    assert.isFalse(fetchStub.called);
  });

  test("maps SendGrid's verdict and checks, and turns the suggested domain into a whole address", async ({
    assert,
  }) => {
    withApiKey("SG.validation");
    fetchStub.resolves(jsonResponse(200, SENDGRID_RESULT));

    const result = await EmailValidationService.check("solan@gmail.con", "signup");

    assert.deepEqual(result, {
      available: true,
      verdict: "Invalid",
      suggestion: "solan@gmail.com",
      checks: {
        hasValidAddressSyntax: true,
        hasMxOrARecord: false,
        isSuspectedDisposableAddress: false,
        isSuspectedRoleAddress: false,
        hasKnownBounces: false,
        hasSuspectedBounces: true,
      },
    });
    const [url, init] = fetchStub.firstCall.args;
    assert.equal(url, SENDGRID_EMAIL_VALIDATION_URL);
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer SG.validation");
    assert.deepEqual(JSON.parse(init.body), { email: "solan@gmail.con", source: "signup" });
  });

  test("a missing suggestion becomes null", async ({ assert }) => {
    withApiKey("SG.validation");
    const { suggestion: _suggestion, ...withoutSuggestion } = SENDGRID_RESULT.result;
    fetchStub.resolves(jsonResponse(200, { result: { ...withoutSuggestion, verdict: "Valid" } }));

    const result = await EmailValidationService.check("solan@gmail.com", "guardian");

    assert.isTrue(result.available);
    if (result.available) {
      assert.equal(result.verdict, "Valid");
      assert.isNull(result.suggestion);
    }
  });

  test("a non-2xx SendGrid response reports unavailable", async ({ assert }) => {
    withApiKey("SG.validation");
    fetchStub.resolves(jsonResponse(429, { errors: [{ message: "too many requests" }] }));

    const result = await EmailValidationService.check("solan@gmail.com", "signup");

    assert.deepEqual(result, { available: false });
  });

  test("an unexpected body reports unavailable", async ({ assert }) => {
    withApiKey("SG.validation");
    fetchStub.resolves(jsonResponse(200, { result: { verdict: "Maybe" } }));

    const result = await EmailValidationService.check("solan@gmail.com", "signup");

    assert.deepEqual(result, { available: false });
  });

  test("a network failure reports unavailable", async ({ assert }) => {
    withApiKey("SG.validation");
    fetchStub.rejects(new Error("ECONNRESET"));

    const result = await EmailValidationService.check("solan@gmail.com", "administrate");

    assert.deepEqual(result, { available: false });
  });
});
