import moment from "moment";

export interface DateFilter {
  fieldName: string;
  op: {
    $lt?: Date;
    $gt?: Date;
    $eq?: Date;
  };
}

export class DbQueryDateFilter {
  private readonly operationIdentifiers: {
    op: string;
    opIdentifier: string;
    atIndex: number;
  }[];

  private readonly dateFormat: string = "DDMMYYYYHHmm";

  public constructor() {
    this.operationIdentifiers = [
      { op: "$gt", opIdentifier: ">", atIndex: 0 },
      { op: "$lt", opIdentifier: "<", atIndex: 0 },
    ];
  }

  public getDateFilters(query: any, validDateParams: string[]): DateFilter[] {
    if (!query || (Object.keys(query).length === 0 && query.constructor === Object)) {
      throw new TypeError("the given query can not be null or undefined");
    }

    try {
      for (const parameter in query) {
        if (Object.hasOwn(query, parameter) && validDateParams.includes(parameter)) {
          return Array.isArray(query[parameter])
            ? this.generateMultipleDateFilter(parameter, query[parameter])
            : [this.generateSingleDayFilter(parameter, query[parameter])];
        }
      }

      return [];
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new SyntaxError("could not parse date filter");
      }
    }

    // @ts-expect-error fixme: auto ignored
    return undefined;
  }

  private generateSingleDayFilter(fieldName: string, value: string): DateFilter {
    if (!value) {
      throw new Error("QueryBuilderDateFilter.generateDateFilter(): value is not defined");
    }

    const operation = this.getOperation(value);

    if (operation) {
      value = value.slice(1);
    }

    let momentDate;

    try {
      momentDate = moment(value, this.dateFormat, true);
    } catch {
      throw new SyntaxError("generateDateFilter(): invalid date");
    }

    if (!momentDate.isValid()) {
      throw new SyntaxError("generateDateFilter(): invalid date");
    }

    const isoDate = momentDate.toDate();
    //let lessThanIsoDate = momentDate.add(1, 'day').toISOString();

    if (operation) {
      const op = { [operation]: isoDate };

      return {
        fieldName,
        op,
      };
    }

    return { fieldName, op: { $eq: isoDate } };
  }

  private generateMultipleDateFilter(fieldName: string, values: string[]): DateFilter[] {
    const operations = {};

    for (const value of values) {
      const op = this.getOperation(value);
      const theDateString = value.slice(1);

      // @ts-expect-error fixme: auto ignored
      operations[op] = moment(theDateString, this.dateFormat, true).toDate();
    }

    return [{ fieldName, op: operations }];
  }

  private getOperation(value: string): string {
    for (const operationIdentifier of this.operationIdentifiers) {
      if (
        value.length >= operationIdentifier.atIndex &&
        operationIdentifier.opIdentifier === value[operationIdentifier.atIndex]
      ) {
        return operationIdentifier.op;
      }
    }

    // @ts-expect-error fixme: auto ignored
    return null;
  }
}
