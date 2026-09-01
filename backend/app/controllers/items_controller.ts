import type { HttpContext } from "@adonisjs/core/http";

import { findItemByIsbn } from "#services/item_lookup";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { SEDbQuery } from "#services/legacy/query/se.db-query";

export default class ItemsController {
  async getBuybackItems() {
    const databaseQuery = new SEDbQuery();
    databaseQuery.booleanFilters = [{ fieldName: "buyback", value: true }];
    databaseQuery.sortFilters = [{ fieldName: "title", direction: 1 }];
    return (await StorageService.Items.getByQuery(databaseQuery)).map((item) => ({
      title: item.title,
      isbn: item.info.isbn,
    }));
  }
  async get(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return (await StorageService.Items.getAll()).toSorted((a, b) => a.title.localeCompare(b.title));
  }

  async getByIsbn(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const item = await findItemByIsbn(ctx.request.param("isbn"));
    return item === null ? null : { id: item.id, title: item.title };
  }
}
