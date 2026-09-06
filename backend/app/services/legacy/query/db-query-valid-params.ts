export interface ValidParameter {
  fieldName: string;
  type: "string" | "number" | "boolean" | "date" | "object-id";
}

export class DbQueryValidParams {
  private readonly validParams: ValidParameter[];

  constructor(validParams: ValidParameter[]) {
    this.validParams = validParams;
  }

  public getValidNumberParams(): string[] {
    return this.getValidParamsBasedOnType("number");
  }

  public getValidStringParams(): string[] {
    return this.getValidParamsBasedOnType("string");
  }

  public getValidObjectIdParams(): string[] {
    return this.getValidParamsBasedOnType("object-id");
  }

  public getValidBooleanParams(): string[] {
    return this.getValidParamsBasedOnType("boolean");
  }

  public getValidDateParams(): string[] {
    return this.getValidParamsBasedOnType("date");
  }

  private getValidParamsBasedOnType(type: string) {
    return this.validParams
      .filter((validParameter) => validParameter.type === type)
      .map((validParameter) => validParameter.fieldName);
  }
}
