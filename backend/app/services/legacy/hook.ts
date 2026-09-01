import type { JwtPayload } from "jsonwebtoken";
import type { ParsedQs } from "qs";

import type { BlDocument } from "#shared/bl-document";

export class Hook {
  public before(
    _body?: unknown,
    _accessToken?: JwtPayload,
    _id?: string,
    _query?: ParsedQs,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }

  after(docs: BlDocument[], _accessToken?: JwtPayload): Promise<BlDocument[]> {
    return Promise.resolve(docs || []);
  }
}
