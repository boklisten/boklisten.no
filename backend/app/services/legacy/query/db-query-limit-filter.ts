export interface LimitFilter {
  limit: number;
}

export class DbQueryLimitFilter {
  public getLimitFilter(query: any): LimitFilter {
    if (!query || (Object.keys(query).length === 0 && query.constructor === Object)) {
      throw new TypeError("the given query can not be null or undefined");
    }
    if (!query.limit) {
      return { limit: 0 };
    }
    if (!this.validNumber(query.limit)) {
      throw new TypeError(
        `limit with value "${query.limit}" is not a valid number, number must be valid and over 0`,
      );
    }

    const limitNumber = Number.parseInt(query.limit);

    return { limit: limitNumber };
  }

  validNumber(limit: any) {
    const limitString = limit.toString();

    for (const n of limitString) {
      if (!Number.parseInt(n) && n !== "0") {
        return false;
      }
    }

    return true;
  }
}
