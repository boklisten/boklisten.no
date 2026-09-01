import type { ParsedQs } from "qs";

export interface OnlyGetFilter {
  fieldName: string;
  value: number;
}

export class DbQueryOnlyGetFilter {
  public getOnlyGetFilters(query: ParsedQs, validOnlyGetParams: string[]): OnlyGetFilter[] {
    if (!query || (Object.keys(query).length === 0 && query.constructor === Object)) {
      throw new TypeError("query can not be undefined or empty");
    }

    if (!query["og"] || validOnlyGetParams.length <= 0) {
      return [];
    }

    return this.generateOnlyGetFilters(query["og"], validOnlyGetParams);
  }

  private generateOnlyGetFilters(og: any, validOnlyGetParams: string[]): OnlyGetFilter[] {
    const onlyGetParameterArray = Array.isArray(og) ? og : [og];

    return onlyGetParameterArray.map((onlyGetParameter) => {
      if (!validOnlyGetParams.includes(onlyGetParameter)) {
        throw new ReferenceError(
          `the parameter "${onlyGetParameter}" is not in validOnlyGetParams`,
        );
      }
      return { fieldName: onlyGetParameter, value: 1 };
    });
  }
}
