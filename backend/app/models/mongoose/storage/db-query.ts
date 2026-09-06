import { ObjectId } from "mongodb";
import type { Types } from "mongoose";

import { BlError } from "#shared/bl-error";

export interface BooleanFilter {
  fieldName: string;
  value: boolean;
}

export interface DateFilter {
  fieldName: string;
  op: {
    $lt?: Date;
    $gt?: Date;
    $eq?: Date;
  };
}

export interface NumberFilter {
  fieldName: string;
  op: {
    $lt?: number;
    $gt?: number;
    $eq?: number;
  };
}

export interface StringFilter {
  fieldName: string;
  value: string;
}

export interface ObjectIdFilter {
  fieldName: string;
  value: Types.ObjectId | string | (Types.ObjectId | string)[];
}

export interface RegexFilter {
  fieldName: string;
  op: {
    $regex: string;
    $options: string;
  };
}

export interface SortFilter {
  fieldName: string;
  direction: 1 | -1;
}

export class SEDbQuery {
  booleanFilters: BooleanFilter[];
  dateFilters: DateFilter[];
  numberFilters: NumberFilter[];
  stringFilters: StringFilter[];
  objectIdFilters: ObjectIdFilter[];
  sortFilters: SortFilter[];
  regexFilters: RegexFilter[];

  constructor() {
    this.booleanFilters = [];
    this.dateFilters = [];
    this.numberFilters = [];
    this.stringFilters = [];
    this.objectIdFilters = [];
    this.sortFilters = [];
    this.regexFilters = [];
  }

  getFilter() {
    const filterObject = {};
    const orArray = [];

    for (const booleanFilter of this.booleanFilters) {
      // @ts-expect-error fixme: auto ignored
      filterObject[booleanFilter.fieldName] = booleanFilter.value;
    }

    for (const dateFilter of this.dateFilters) {
      // @ts-expect-error fixme: auto ignored
      filterObject[dateFilter.fieldName] = dateFilter.op;
    }

    for (const numberFilter of this.numberFilters) {
      // @ts-expect-error fixme: auto ignored
      filterObject[numberFilter.fieldName] = numberFilter.op;
    }

    for (const stringFilter of this.stringFilters) {
      if (Array.isArray(stringFilter.value)) {
        const array = stringFilter.value;
        for (const stringValue of array) {
          const multipleValuesFilterObject = { [stringFilter.fieldName]: stringValue };
          orArray.push(multipleValuesFilterObject);
        }
      } else {
        // @ts-expect-error fixme: auto ignored
        filterObject[stringFilter.fieldName] = stringFilter.value;
      }
    }

    for (const objectIdFilter of this.objectIdFilters) {
      if (Array.isArray(objectIdFilter.value)) {
        const array = objectIdFilter.value;
        for (const stringValue of array) {
          if (!ObjectId.isValid(stringValue)) {
            throw new BlError(`Invalid ObjectID: ${String(stringValue)}`).code(701);
          }
          const multipleValuesFilterObject = { [objectIdFilter.fieldName]: stringValue };
          orArray.push(multipleValuesFilterObject);
        }
      } else {
        if (!ObjectId.isValid(objectIdFilter.value)) {
          throw new BlError(`Invalid ObjectID: ${String(objectIdFilter.value)}`).code(701);
        }

        // @ts-expect-error fixme: auto ignored
        filterObject[objectIdFilter.fieldName] = objectIdFilter.value;
      }
    }

    for (const regexFilter of this.regexFilters) {
      const regexFilterObject = { [regexFilter.fieldName]: regexFilter.op };
      orArray.push(regexFilterObject);
    }

    if (orArray.length > 0) {
      // @ts-expect-error fixme: auto ignored
      filterObject["$or"] = orArray;
    }

    return filterObject;
  }

  getSortFilter() {
    const sortFilterObject = {};

    for (const sortFilter of this.sortFilters) {
      // @ts-expect-error fixme: auto ignored
      sortFilterObject[sortFilter.fieldName] = sortFilter.direction;
    }

    return sortFilterObject;
  }
}
