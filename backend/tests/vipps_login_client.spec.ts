import { createHash, generateKeyPairSync, sign } from "node:crypto";

import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { VippsLoginClient } from "#services/vipps/vipps_login_client";
import env from "#start/env";

const ISSUER = "https://api.vipps.no/access-management-1.0/access/";
const vippsKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
const forgerKey = generateKeyPairSync("rsa", { modulusLength: 2048 });

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** An RS256 id_token for `sub`, signed with `privateKey`. */
function idToken(privateKey: typeof vippsKey.privateKey, sub = "vipps-kari"): string {
  const now = Math.floor(Date.now() / 1000);
  const signed = `${base64url({ alg: "RS256", kid: "vipps" })}.${base64url({
    iss: ISSUER,
    aud: env.get("VIPPS_CLIENT_ID"),
    sub,
    iat: now,
    exp: now + 300,
  })}`;
  return `${signed}.${sign("sha256", Buffer.from(signed), privateKey).toString("base64url")}`;
}

function json(body: object): Response {
  return Response.json(body);
}

/**
 * Stands in for Vipps: its discovery document, keys, token endpoint (answering with `token`) and
 * userinfo. Records the token request.
 */
function fakeVipps(sandbox: sinon.SinonSandbox, token: string) {
  const tokenRequests: { headers: Headers; body: URLSearchParams }[] = [];
  sandbox.stub(globalThis, "fetch").callsFake(async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.endsWith("/.well-known/openid-configuration")) {
      return json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}oauth2/auth`,
        token_endpoint: `${ISSUER}oauth2/token`,
        userinfo_endpoint: "https://api.vipps.no/vipps-userinfo-api/userinfo",
        jwks_uri: `${ISSUER}.well-known/jwks.json`,
        id_token_signing_alg_values_supported: ["RS256"],
      });
    }
    if (url.endsWith("/jwks.json")) {
      const jwk = vippsKey.publicKey.export({ format: "jwk" });
      return json({ keys: [{ ...jwk, kid: "vipps", alg: "RS256", use: "sig" }] });
    }
    if (url.endsWith("/oauth2/token")) {
      tokenRequests.push({
        headers: new Headers(init?.headers),
        body: init?.body instanceof URLSearchParams ? init.body : new URLSearchParams(),
      });
      return json({
        access_token: "access",
        token_type: "bearer",
        expires_in: 300,
        id_token: token,
      });
    }
    if (url.endsWith("/userinfo")) {
      return json({
        sub: "vipps-kari",
        name: "Kari Nordmann",
        email: "kari@example.com",
        email_verified: true,
        phone_number: "4741111111",
        phone_number_verified: true,
      });
    }
    throw new Error(`Unexpected request to ${url}`);
  });
  return { tokenRequests };
}

test.group("VippsLoginClient", (group) => {
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());

  test("asks Vipps for an S256 challenge of the verifier it hands back", async ({ assert }) => {
    fakeVipps(sandbox, "");

    const { url, pending } = await VippsLoginClient.start();

    const params = new URL(url).searchParams;
    assert.equal(params.get("state"), pending.state);
    assert.equal(params.get("code_challenge_method"), "S256");
    assert.equal(
      params.get("code_challenge"),
      createHash("sha256").update(pending.codeVerifier).digest("base64url"),
    );
  });

  test("reads the profile of the person a genuine id_token names", async ({ assert }) => {
    const { tokenRequests } = fakeVipps(sandbox, idToken(vippsKey.privateKey));

    const person = await VippsLoginClient.finish("code=code&state=state", {
      state: "state",
      codeVerifier: "verifier",
    });

    assert.equal(person.id, "vipps-kari");
    assert.equal(person.phoneNumber, "41111111");
    const [request] = tokenRequests;
    assert.equal(request?.body.get("code_verifier"), "verifier");
    assert.match(String(request?.body.get("redirect_uri")), /\/auth\/vipps\/callback$/);
    // Vipps' documented header: plain base64 of "id:secret", no client secret in the body.
    const credentials = `${env.get("VIPPS_CLIENT_ID")}:${env.get("VIPPS_SECRET").release()}`;
    assert.equal(
      request?.headers.get("authorization"),
      `Basic ${Buffer.from(credentials).toString("base64")}`,
    );
    assert.isFalse(request?.body.has("client_secret"));
  });

  test("rejects an id_token Vipps did not sign", async ({ assert }) => {
    fakeVipps(sandbox, idToken(forgerKey.privateKey));

    const rejection = await VippsLoginClient.finish("code=code&state=state", {
      state: "state",
      codeVerifier: "verifier",
    }).catch((error: unknown) => error);

    const cause = rejection instanceof Error ? rejection.cause : undefined;
    assert.match(cause instanceof Error ? cause.message : "", /JWT signature verification failed/);
  });
});
