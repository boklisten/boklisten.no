export interface RegexFilter {
  fieldName: string;
  op: {
    $regex: string;
    $options: string;
  };
}

export class DbQueryRegexFilter {
  getRegexFilters(query: any, validRegexParams: string[]): RegexFilter[] {
    if (!query || (Object.keys(query).length === 0 && query.constructor === Object)) {
      throw new TypeError("query can not be undefined or empty");
    }

    let searchString = query.s;

    if (!searchString) {
      return [];
    }

    searchString = this.sanitizeSearchString(searchString);

    if (searchString.length < 3) {
      throw new TypeError(`search string "${searchString}" is under 3 chars long`);
    }

    return this.generateRegexFilters(searchString, validRegexParams);
  }

  private sanitizeSearchString(searchString: string) {
    const searchStringArray = searchString.split(" ");
    let returnString = "";
    for (const word of searchStringArray) {
      if (returnString.length > 0) {
        returnString += String.raw`[^\\S]`;
      }
      returnString += word;
    }
    return returnString;
  }

  private generateRegexFilters(searchString: string, validRegexParams: string[]): RegexFilter[] {
    return validRegexParams.map((validRegexParameter) => ({
      fieldName: validRegexParameter,
      op: { $regex: searchString, $options: "imx" },
    }));
  }
}
