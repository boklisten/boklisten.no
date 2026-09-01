export interface NumberFilter {
  fieldName: string;
  op: {
    $lt?: number;
    $gt?: number;
    $eq?: number;
  };
}

export class DbQueryNumberFilter {
  private readonly operationIdentifiers = [
    { op: "$gt", opIdentifier: ">", atIndex: 0 },
    { op: "$lt", opIdentifier: "<", atIndex: 0 },
  ];

  private readonly equalOperation = "$eq";

  public getNumberFilters(query: any, validNumberParams: string[]): NumberFilter[] {
    const numberFilters: NumberFilter[] = [];

    if (!query || (Object.keys(query).length === 0 && query.constructor === Object)) {
      throw new TypeError("the given query can not be null or undefined");
    }
    if (validNumberParams.length <= 0) {
      return [];
    }

    try {
      for (const parameter in query) {
        if (validNumberParams.includes(parameter)) {
          const numberFilter = Array.isArray(query[parameter])
            ? this.generateNumberFilterForParamWithMultipleValues(parameter, query[parameter])
            : this.generateNumberFilterForParamWithSingleValue(parameter, query[parameter]);

          numberFilters.push(numberFilter);
        }
      }

      return numberFilters;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new TypeError(`query includes bad number data, reason: ${error.message}`, {
          cause: error,
        });
      }
      if (error instanceof SyntaxError) {
        throw new SyntaxError(`query includes syntax errors, reason: ${error.message}`);
      }
      throw new Error(
        // @ts-expect-error fixme: auto ignored
        `failure when parsing query for number operations${error.message}`,
        { cause: error },
      );
    }
  }

  private generateNumberFilterForParamWithSingleValue(
    fieldName: string,
    value: string,
  ): NumberFilter {
    if (!value) {
      throw new Error("QueryBuilderNumberFilter.generateNumberFilter(): value is not defined");
    }

    if (this.valueHasOperationIdentifier(value)) {
      const opWithValue = this.getOperationWithValue(value);
      const op: any = {};

      op[opWithValue.operation] = opWithValue.value;

      return { fieldName, op };
    }

    return this.validateNumberFilter({
      fieldName,
      op: { $eq: this.extractNumberFromQueryString(value) },
    });
  }

  private generateNumberFilterForParamWithMultipleValues(
    fieldName: string,
    values: string[],
  ): NumberFilter {
    if (values.length <= 0) {
      throw new RangeError("the supplied array is empty");
    }

    const op: any = {};

    for (const value of values) {
      const opWithValue = this.getOperationWithValue(value);
      op[opWithValue.operation] = opWithValue.value;
    }

    return this.validateNumberFilter({ fieldName, op });
  }

  private validateNumberFilter(numberFilter: NumberFilter) {
    if (numberFilter.op.$eq && (numberFilter.op.$gt || numberFilter.op.$lt)) {
      throw new SyntaxError("numberFilter cannot combine eq operation with other operations");
    }

    return numberFilter;
  }

  private valueHasOperationIdentifier(value: string): boolean {
    return this.operationIdentifiers.some(
      (operationIdentifier) =>
        value.length >= operationIdentifier.atIndex &&
        operationIdentifier.opIdentifier === value[operationIdentifier.atIndex],
    );
  }

  private getOperationWithValue(value: string): {
    operation: string;
    value: number;
  } {
    const operation = this.getOperation(value);
    const number: number = this.extractNumberFromQueryString(
      operation === this.equalOperation ? value : value.slice(1),
    );

    return {
      operation,
      value: number,
    };
  }

  private getOperation(value: string): string {
    const foundOperation = this.operationIdentifiers.find(
      (operationIdentifier) =>
        value.length >= operationIdentifier.atIndex &&
        operationIdentifier.opIdentifier === value[operationIdentifier.atIndex],
    )?.op;

    return foundOperation ?? this.equalOperation;
  }

  private extractNumberFromQueryString(number_: string): number {
    if (number_.split("").some((n) => isNaN(Number.parseInt(n, 10)))) {
      throw new TypeError(`value "${number_}" is not a valid number`);
    }
    return Number.parseInt(number_, 10);
  }
}
