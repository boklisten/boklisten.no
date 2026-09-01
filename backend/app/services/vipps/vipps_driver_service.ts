import { Oauth2Driver } from "@adonisjs/ally";
import type {
  AllyUserContract,
  ApiRequestContract,
  LiteralStringUnion,
  RedirectRequestContract,
} from "@adonisjs/ally/types";
import type { HttpContext } from "@adonisjs/core/http";

import type { VippsUser } from "#types/user";

interface VippsDriverAccessToken {
  token: string;
  type: "bearer";
}

type VippsDriverScopes =
  | "openid"
  | "address"
  | "birthDate"
  | "email"
  | "name"
  | "phoneNumber"
  | "gender"
  | "nin"
  | "delegatedConsents";

type VippsApiEnvironment = "production" | "test";

interface VippsDriverConfig {
  environment: VippsApiEnvironment;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scopes: LiteralStringUnion<VippsDriverScopes>[];
}

function buildApiUrl(environment: VippsApiEnvironment, path: string) {
  return `https://${environment === "production" ? "api" : "apitest"}.vipps.no/${path}`;
}

class VippsDriver extends Oauth2Driver<VippsDriverAccessToken, VippsDriverScopes> {
  protected authorizeUrl;
  protected accessTokenUrl;
  protected userInfoUrl;
  protected codeParamName = "code";
  protected errorParamName = "error";
  protected stateCookieName = "vipps_oauth_state";
  protected stateParamName = "state";
  protected scopeParamName = "scope";
  protected scopesSeparator = " ";

  constructor(
    ctx: HttpContext,
    public override config: VippsDriverConfig,
  ) {
    super(ctx, config);
    this.authorizeUrl = buildApiUrl(config.environment, "access-management-1.0/access/oauth2/auth");
    this.accessTokenUrl = buildApiUrl(
      config.environment,
      "access-management-1.0/access/oauth2/token",
    );
    this.userInfoUrl = buildApiUrl(config.environment, "vipps-userinfo-api/userinfo");

    this.loadState();
  }

  protected override configureRedirectRequest(request: RedirectRequestContract<VippsDriverScopes>) {
    request.scopes(this.config.scopes);
    request.param("response_type", "code");
  }

  protected override configureAccessTokenRequest(request: ApiRequestContract) {
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
      "utf8",
    ).toString("base64");
    request.header("Authorization", `Basic ${credentials}`);

    request.field("grant_type", "authorization_code");
    request.field("code", this.ctx.request.input(this.codeParamName));
    request.field("redirect_uri", this.config.callbackUrl);
  }

  protected getAuthenticatedRequest(url: string, token: string) {
    const request = this.httpClient(url);
    request.header("Authorization", `Bearer ${token}`);
    request.header("Accept", "application/json");
    request.parseAs("json");
    return request;
  }

  protected async getUserInfo(token: string, callback?: (request: ApiRequestContract) => void) {
    const request = this.getAuthenticatedRequest(this.userInfoUrl, token);
    if (typeof callback === "function") {
      callback(request);
    }

    const body = await request.get();
    return {
      id: body.sub,
      name: body.name,
      email: body.email,
      emailVerified: body.email_verified,
      phoneNumber: body.phone_number.slice(-8),
      phoneNumberVerified: body.phone_number_verified,
      address: body.address.street_address,
      postalCode: body.address.postal_code,
      postalCity: body.address.region,

      nickName: body.given_name,
      emailVerificationState: body.email_verified ? "verified" : "unverified",
      avatarUrl: "",
      original: body,
    } as const;
  }

  accessDenied() {
    return this.ctx.request.input(this.errorParamName) === "access_denied";
  }

  async user(
    callback?: (request: ApiRequestContract) => void,
  ): Promise<AllyUserContract<VippsDriverAccessToken> & VippsUser> {
    const token = await this.accessToken(callback);
    const user = await this.getUserInfo(token.token, callback);

    return {
      ...user,
      token,
    } as const;
  }

  async userFromToken(
    token: string,
    callback?: (request: ApiRequestContract) => void,
  ): Promise<AllyUserContract<VippsDriverAccessToken> & VippsUser> {
    const user = await this.getUserInfo(token, callback);
    return {
      ...user,
      token: { token, type: "bearer" },
    } as const;
  }
}

export function VippsDriverService(config: VippsDriverConfig): (ctx: HttpContext) => VippsDriver {
  return (ctx) => new VippsDriver(ctx, config);
}
