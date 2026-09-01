import type { ParsedQs } from "qs";

export interface BooleanFilter {
  fieldName: string;
  value: boolean;
}

export class DbQueryBooleanFilter {
  public getBooleanFilters(query: ParsedQs, validBooleanParams: string[]): BooleanFilter[] {
    if (!query || (Object.keys(query).length === 0 && query.constructor === Object)) {
      throw new TypeError("the given query can not be null or undefined");
    }

    return this.generateBooleanFilters(query, validBooleanParams);
  }

  private generateBooleanFilters(query: ParsedQs, validBooleanParams: string[]): BooleanFilter[] {
    const booleanFilters: BooleanFilter[] = [];

    for (const parameter in query) {
      if (validBooleanParams.includes(parameter)) {
        let value = false;
        if (query[parameter] === "true") {
          value = true;
        } else if (query[parameter] === "false") {
          value = false;
        } else {
          throw new TypeError(`value "${query[parameter]}" could not be parsed to boolean`);
        }

        booleanFilters.push({ fieldName: parameter, value });
      }
    }

    return booleanFilters;
  }
}
