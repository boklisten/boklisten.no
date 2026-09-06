import type { ParsedQs } from "qs";

import { DbQueryBooleanFilter } from "#services/legacy/query/db-query-boolean-filter";
import { DbQueryDateFilter } from "#services/legacy/query/db-query-date-filter";
import { DbQueryNumberFilter } from "#services/legacy/query/db-query-number-filter";
import { DbQueryObjectIdFilter } from "#services/legacy/query/db-query-object-id-filter";
import { DbQueryRegexFilter } from "#services/legacy/query/db-query-regex-filter";
import { DbQueryStringFilter } from "#services/legacy/query/db-query-string-filter";
import type { ValidParameter } from "#services/legacy/query/db-query-valid-params";
import { DbQueryValidParams } from "#services/legacy/query/db-query-valid-params";
import { SEDbQuery } from "#models/mongoose/storage/db-query";

export class SEDbQueryBuilder {
  private readonly dbQueryBooleanFilter: DbQueryBooleanFilter;
  private readonly dbQueryDateFilter: DbQueryDateFilter;
  private readonly dbQueryNumberFilter: DbQueryNumberFilter;
  private readonly dbQueryRegexFilter: DbQueryRegexFilter;
  private readonly dbQueryStringFilter: DbQueryStringFilter;
  private readonly dbQueryObjectIdFilter: DbQueryObjectIdFilter;

  constructor() {
    this.dbQueryBooleanFilter = new DbQueryBooleanFilter();
    this.dbQueryDateFilter = new DbQueryDateFilter();
    this.dbQueryNumberFilter = new DbQueryNumberFilter();
    this.dbQueryRegexFilter = new DbQueryRegexFilter();
    this.dbQueryStringFilter = new DbQueryStringFilter();
    this.dbQueryObjectIdFilter = new DbQueryObjectIdFilter();
  }

  public getDbQuery(query: ParsedQs, validQueryParams: ValidParameter[]): SEDbQuery {
    const dbQueryValidParams = new DbQueryValidParams(validQueryParams);

    const databaseQuery: SEDbQuery = new SEDbQuery();

    if (!query || (Object.keys(query).length === 0 && query.constructor === Object)) {
      return databaseQuery;
    }

    try {
      databaseQuery.booleanFilters = this.dbQueryBooleanFilter.getBooleanFilters(
        query,
        dbQueryValidParams.getValidBooleanParams(),
      );
      databaseQuery.dateFilters = this.dbQueryDateFilter.getDateFilters(
        query,
        dbQueryValidParams.getValidDateParams(),
      );
      databaseQuery.numberFilters = this.dbQueryNumberFilter.getNumberFilters(
        query,
        dbQueryValidParams.getValidNumberParams(),
      );
      databaseQuery.regexFilters = this.dbQueryRegexFilter.getRegexFilters(
        query,
        dbQueryValidParams.getValidStringParams(),
      );
      databaseQuery.stringFilters = this.dbQueryStringFilter.getStringFilters(
        query,
        dbQueryValidParams.getValidStringParams(),
      );
      databaseQuery.objectIdFilters = this.dbQueryObjectIdFilter.getObjectIdFilters(
        query,
        dbQueryValidParams.getValidObjectIdParams(),
      );
    } catch (error) {
      if (error instanceof TypeError) {
        throw new TypeError(`TypeError when building query, reason: ${error.message}`, {
          cause: error,
        });
      }
      if (error instanceof ReferenceError) {
        throw new ReferenceError(`ReferenceError when building query, reason: ${error.message}`);
      }
      if (error instanceof RangeError) {
        throw new RangeError(`RangeError when building query, reason: ${error.message}`);
      }

      // @ts-expect-error fixme: auto ignored
      throw new Error(`Error when building query, reason: ${error.message}`, { cause: error });
    }

    return databaseQuery;
  }
}
