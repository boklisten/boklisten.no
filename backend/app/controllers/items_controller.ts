import type { HttpContext } from "@adonisjs/core/http";

import { findItemByIsbn } from "#services/item_lookup";
import { ItemManagementService } from "#services/item_management_service";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import {
  bulkUpsertItemsValidator,
  createItemValidator,
  updateItemValidator,
} from "#validators/items";

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

  async getAllForAdmin(ctx: HttpContext) {
    const { permission } = PermissionService.adminOrFail(ctx);
    return (await StorageService.Items.getAll(permission)).toSorted((a, b) =>
      a.title.localeCompare(b.title, "nb"),
    );
  }

  async getByIsbn(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const item = await findItemByIsbn(ctx.request.param("isbn"));
    return item === null ? null : { id: item.id, title: item.title };
  }

  async create(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const input = await ctx.request.validateUsing(createItemValidator);
    return ItemManagementService.create(input);
  }

  async update(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const patch = await ctx.request.validateUsing(updateItemValidator);
    return ItemManagementService.update(ctx.request.param("id"), patch);
  }

  async bulkUpsert(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { items } = await ctx.request.validateUsing(bulkUpsertItemsValidator);
    return ItemManagementService.bulkUpsert(items);
  }
}
