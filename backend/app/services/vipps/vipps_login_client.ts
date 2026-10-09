import * as oidc from "openid-client";

import { apiOrigin } from "#config/app";
import { phoneDigits } from "#shared/phone_number";
import env from "#start/env";
import type { VippsUser } from "#types/user";

const ISSUER = new URL("https://api.vipps.no/access-management-1.0/access/");

/** Registered for the sales unit in the Vipps portal, and must match it byte for byte. */
const CALLBACK_URL = `${apiOrigin}/auth/vipps/callback`;

/** Consent covers the whole list or nothing, so ask for no more than an account needs. */
const SCOPES = "openid email phoneNumber address name";

/** Vipps serves its discovery document with `max-age=3600`. */
const DISCOVERY_MAX_AGE_MS = 60 * 60 * 1000;

/** What the callback needs from the browser that started the login. */
export interface PendingVippsLogin {
  state: string;
  codeVerifier: string;
}

/**
 * Vipps documents the header as `Basic base64(client_id:client_secret)`, without the form encoding
 * openid-client's `ClientSecretBasic` applies to both halves first.
 */
function vippsClientSecretBasic(clientSecret: string): oidc.ClientAuth {
  return (_server, client, _body, headers) => {
    const credentials = Buffer.from(`${client.client_id}:${clientSecret}`).toString("base64");
    headers.set("authorization", `Basic ${credentials}`);
  };
}

let discovered: { configuration: Promise<oidc.Configuration>; expiresAt: number } | undefined;

function vippsUserOf(profile: oidc.UserInfoResponse): VippsUser {
  return {
    id: profile.sub,
    name: profile.name ?? "",
    email: profile.email ?? "",
    emailVerified: profile.email_verified === true,
    // Vipps sends "4791234567"; a foreign number keeps its country code.
    phoneNumber: phoneDigits(`+${profile.phone_number ?? ""}`),
    phoneNumberVerified: profile["phone_number_verified"] === true,
    // Vipps sends empty strings, or leaves `address` out, for a user who has not registered one.
    address: profile.address?.street_address ?? "",
    postalCode: profile.address?.postal_code ?? "",
    postalCity: profile.address?.region ?? "",
  };
}

export const VippsLoginClient = {
  /**
   * Vipps' endpoints from its discovery document, cached for as long as Vipps asks. id_token
   * signatures are checked against Vipps' published keys, which openid-client caches too.
   */
  configuration(): Promise<oidc.Configuration> {
    if (discovered && Date.now() < discovered.expiresAt) {
      return discovered.configuration;
    }
    const configuration = oidc.discovery(
      ISSUER,
      env.get("VIPPS_CLIENT_ID"),
      undefined,
      vippsClientSecretBasic(env.get("VIPPS_SECRET").release()),
      { execute: [oidc.enableNonRepudiationChecks] },
    );
    discovered = { configuration, expiresAt: Date.now() + DISCOVERY_MAX_AGE_MS };
    // A failed discovery must not stick for the hour.
    configuration.catch(() => {
      if (discovered?.configuration === configuration) {
        discovered = undefined;
      }
    });
    return configuration;
  },

  /** Where to send the browser, and what its callback must prove (state, PKCE S256). */
  async start(): Promise<{ url: string; pending: PendingVippsLogin }> {
    const pending = { state: oidc.randomState(), codeVerifier: oidc.randomPKCECodeVerifier() };
    const url = oidc.buildAuthorizationUrl(await VippsLoginClient.configuration(), {
      response_type: "code",
      redirect_uri: CALLBACK_URL,
      scope: SCOPES,
      state: pending.state,
      code_challenge: await oidc.calculatePKCECodeChallenge(pending.codeVerifier),
      code_challenge_method: "S256",
    });
    return { url: url.href, pending };
  },

  /**
   * Trades the code in the callback's query string for tokens, checks the id_token (signature,
   * issuer, audience, expiry) and reads the profile of the person it names.
   */
  async finish(query: string, pending: PendingVippsLogin): Promise<VippsUser> {
    const configuration = await VippsLoginClient.configuration();
    // openid-client sends the URL it is handed, minus the query, as `redirect_uri`; behind the
    // proxy the request's own host would not match the registered one.
    const callbackUrl = new URL(CALLBACK_URL);
    callbackUrl.search = query;
    const tokens = await oidc.authorizationCodeGrant(configuration, callbackUrl, {
      expectedState: pending.state,
      pkceCodeVerifier: pending.codeVerifier,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) {
      throw new Error("Vipps returned no id_token");
    }
    return vippsUserOf(await oidc.fetchUserInfo(configuration, tokens.access_token, claims.sub));
  },
};
