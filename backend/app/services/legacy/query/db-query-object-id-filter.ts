import { ObjectId } from "mongodb";
import { Types } from "mongoose";

export interface ObjectIdFilter {
  fieldName: string;
  value: Types.ObjectId | string | (Types.ObjectId | string)[];
}

export class DbQueryObjectIdFilter {
  getObjectIdFilters(query: any, validStringParams: string[]): ObjectIdFilter[] {
    if (!query || (Object.keys(query).length === 0 && query.constructor === Object)) {
      throw new TypeError("query can not be undefined or empty");
    }
    if (validStringParams.length <= 0) return [];

    const objectIdFilters: ObjectIdFilter[] = [];

    if (ObjectId.isValid(query.s)) {
      query._id = query.s;
    }

    try {
      for (const parameter in query) {
        if (validStringParams.includes(parameter)) {
          if (Array.isArray(query[parameter])) {
            const valueArray: (string | Types.ObjectId)[] = [];
            query[parameter].forEach((parameterValue: string) => {
              valueArray.push(this.getStringParamValue(parameterValue));
              valueArray.push(this.getObjectIdParamValue(parameterValue));
            });
            objectIdFilters.push({
              fieldName: parameter,
              value: valueArray,
            });
          } else {
            const valueArray = [
              this.getStringParamValue(query[parameter]),
              this.getObjectIdParamValue(query[parameter]),
            ];
            objectIdFilters.push({
              fieldName: parameter,
              value: valueArray,
            });
          }
        }
      }

      return objectIdFilters;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new TypeError(
          "query includes bad object-id parameter data, reason: " + error.message,
          { cause: error },
        );
      }

      throw new Error(
        "could not parse the object-id parameters in query, reason: " +
          // @ts-expect-error fixme: auto ignored
          error.message,
        { cause: error },
      );
    }
  }

  private getObjectIdParamValue(parameter: string): Types.ObjectId {
    if (this.validateStringParam(parameter)) {
      return new Types.ObjectId(parameter);
    }
    throw new TypeError('the paramterer of value "' + parameter + '" is not a valid string');
  }

  private getStringParamValue(parameter: string): string {
    if (this.validateStringParam(parameter)) {
      return parameter;
    }
    throw new TypeError('the paramterer of value "' + parameter + '" is not a valid string');
  }

  private validateStringParam(parameter?: string): boolean {
    return (parameter?.length ?? 0) > 0 && new Types.ObjectId(parameter).toString() === parameter;
  }
}
