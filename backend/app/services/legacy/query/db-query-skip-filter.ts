import type { ParsedQs } from "qs";

export interface SkipFilter {
  skip: number;
}

export class DbQuerySkipFilter {
  public getSkipFilter(query: ParsedQs): SkipFilter {
    if (!query || (Object.keys(query).length === 0 && query.constructor === Object)) {
      throw new TypeError("query can not be undefined or empty");
    }

    if (!query["skip"]) {
      return { skip: 0 };
    }

    return { skip: this.getSkipNumber(query["skip"]) };
  }

  private getSkipNumber(skip: any): number {
    const skipstr = skip.toString();

    for (const s of skipstr) {
      if (s !== "0" && !Math.trunc(Number(s))) {
        throw new TypeError(`skip parameter "${skip}" is not a valid number`);
      }
    }

    return Math.trunc(Number(skipstr));
  }
}
