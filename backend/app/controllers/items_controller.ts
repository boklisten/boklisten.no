import type { HttpContext } from "@adonisjs/core/http";

import { findItemByIsbn } from "#services/item_lookup";
import { ItemManagementService } from "#services/item_management_service";
import { StorageService } from "#services/storage_service";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import {
  bulkUpsertItemsValidator,
  createItemValidator,
  updateItemValidator,
} from "#validators/items";

export default class ItemsController {
  async buyback() {
    const databaseQuery = new SEDbQuery();
    databaseQuery.booleanFilters = [{ fieldName: "buyback", value: true }];
    databaseQuery.sortFilters = [{ fieldName: "title", direction: 1 }];
    return (await StorageService.Items.getByQuery(databaseQuery)).map((item) => ({
      title: item.title,
      isbn: item.info.isbn,
    }));
  }
  async index() {
    return (await StorageService.Items.getAll()).toSorted((a, b) => a.title.localeCompare(b.title));
  }

  async all(ctx: HttpContext) {
    const { permission } = ctx.authUser;
    return (await StorageService.Items.getAll(permission)).toSorted((a, b) =>
      a.title.localeCompare(b.title, "nb"),
    );
  }

  async showByIsbn(ctx: HttpContext) {
    const item = await findItemByIsbn(ctx.request.param("isbn"));
    return item === null ? null : { id: item.id, title: item.title };
  }

  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createItemValidator);
    return ItemManagementService.create(input);
  }

  async update(ctx: HttpContext) {
    const patch = await ctx.request.validateUsing(updateItemValidator);
    return ItemManagementService.update(ctx.request.param("id"), patch);
  }

  async bulkUpsert(ctx: HttpContext) {
    const { items } = await ctx.request.validateUsing(bulkUpsertItemsValidator);
    return ItemManagementService.bulkUpsert(items);
  }
}
