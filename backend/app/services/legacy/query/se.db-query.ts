import { ObjectId } from "mongodb";

import type { BooleanFilter } from "#services/legacy/query/db-query-boolean-filter";
import type { DateFilter } from "#services/legacy/query/db-query-date-filter";
import type { ExpandFilter } from "#services/legacy/query/db-query-expand-filter";
import type { LimitFilter } from "#services/legacy/query/db-query-limit-filter";
import type { NumberFilter } from "#services/legacy/query/db-query-number-filter";
import type { ObjectIdFilter } from "#services/legacy/query/db-query-object-id-filter";
import type { OnlyGetFilter } from "#services/legacy/query/db-query-only-get-filter";
import type { RegexFilter } from "#services/legacy/query/db-query-regex-filter";
import type { SkipFilter } from "#services/legacy/query/db-query-skip-filter";
import type { SortFilter } from "#services/legacy/query/db-query-sort-filter";
import type { StringFilter } from "#services/legacy/query/db-query-string-filter";
import { BlError } from "#shared/bl-error";

export class SEDbQuery {
  booleanFilters: BooleanFilter[];
  dateFilters: DateFilter[];
  numberFilters: NumberFilter[];
  stringFilters: StringFilter[];
  objectIdFilters: ObjectIdFilter[];
  onlyGetFilters: OnlyGetFilter[];
  skipFilter: SkipFilter;
  sortFilters: SortFilter[];
  limitFilter: LimitFilter;
  regexFilters: RegexFilter[];
  expandFilters: ExpandFilter[];

  constructor() {
    this.booleanFilters = [];
    this.dateFilters = [];
    this.numberFilters = [];
    this.stringFilters = [];
    this.objectIdFilters = [];
    this.onlyGetFilters = [];
    this.skipFilter = { skip: 0 };
    this.sortFilters = [];
    this.limitFilter = { limit: 0 };
    this.regexFilters = [];
    this.expandFilters = [];
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

  getOgFilter() {
    const ogFilterObject = {};

    for (const ogFilter of this.onlyGetFilters) {
      // @ts-expect-error fixme: auto ignored
      ogFilterObject[ogFilter.fieldName] = ogFilter.value;
    }
    return ogFilterObject;
  }

  getLimitFilter(): number {
    return this.limitFilter.limit;
  }

  getSkipFilter(): number {
    return this.skipFilter.skip;
  }

  getExpandFilter() {
    return this.expandFilters;
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
