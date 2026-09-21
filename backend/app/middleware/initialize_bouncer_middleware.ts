import { Bouncer } from "@adonisjs/bouncer";
import type { HttpContext } from "@adonisjs/core/http";
import type { NextFn } from "@adonisjs/core/types/http";

import * as abilities from "#abilities/main";

/** Creates the bouncer for the request's user (set by the auth middleware) and shares it as `ctx.bouncer`. */
export default class InitializeBouncerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.bouncer = new Bouncer(() => ctx.auth.user ?? null, abilities).setContainerResolver(
      ctx.containerResolver,
    );
    return next();
  }
}

declare module "@adonisjs/core/http" {
  export interface HttpContext {
    bouncer: Bouncer<Exclude<HttpContext["auth"]["user"], undefined>, typeof abilities>;
  }
}
