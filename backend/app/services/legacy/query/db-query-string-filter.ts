export interface StringFilter {
  fieldName: string;
  value: string;
}

export class DbQueryStringFilter {
  getStringFilters(query: any, validStringParams: string[]): StringFilter[] {
    if (!query || (Object.keys(query).length === 0 && query.constructor === Object)) {
      throw new TypeError("query can not be undefined or empty");
    }
    if (validStringParams.length <= 0) {
      return [];
    }

    const stringFilters: StringFilter[] = [];

    try {
      for (const parameter in query) {
        if (validStringParams.includes(parameter)) {
          stringFilters.push({
            fieldName: parameter,

            // @ts-expect-error fixme: auto ignored
            value: Array.isArray(query[parameter])
              ? query[parameter]
              : this.getStringParamValue(query[parameter]),
          });
        }
      }

      return stringFilters;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new TypeError(`query includes bad string parameter data, reason: ${error.message}`, {
          cause: error,
        });
      }

      throw new Error(
        `could not parse the string parameters in query, reason: ${
          // @ts-expect-error fixme: auto ignored
          error.message
        }`,
        { cause: error },
      );
    }
  }

  private getStringParamValue(parameter: string): string {
    if (this.validateStringParam(parameter)) {
      return parameter;
    }
    throw new TypeError(`the paramterer of value "${parameter}" is not a valid string`);
  }

  private validateStringParam(parameter: string): boolean {
    // @ts-expect-error fixme: auto ignored
    return parameter && typeof parameter === "string" && parameter.length > 0;
  }
}
