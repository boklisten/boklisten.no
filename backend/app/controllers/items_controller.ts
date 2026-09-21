import type { HttpContext } from "@adonisjs/core/http";

import { hasPermission } from "#abilities/main";

import Item from "#models/item";
import { findItemByIsbn } from "#services/item_lookup";
import { ItemManagementService } from "#services/item_management_service";
import ItemTransformer from "#transformers/item_transformer";
import {
  bulkUpsertItemsValidator,
  createItemValidator,
  updateItemValidator,
} from "#validators/items";

function byTitle(items: Item[]): Item[] {
  return items.toSorted((a, b) => a.title.localeCompare(b.title, "nb"));
}

export default class ItemsController {
  /** The public list of titles the stand buys back. */
  async buyback() {
    const items = await Item.query().where("buyback", true);
    return byTitle(items).map((item) => ({ title: item.title, isbn: item.isbn }));
  }

  /** The catalogue as customers may see it. */
  async index(ctx: HttpContext) {
    const items = await Item.query().withScopes((scopes) => scopes.activeOnly());
    return ctx.serialize(ItemTransformer.transform(byTitle(items)));
  }

  /** The whole catalogue for administrators; other employees see what customers see. */
  async all(ctx: HttpContext) {
    const query = Item.query();
    if (await ctx.bouncer.denies(hasPermission, "admin")) {
      void query.withScopes((scopes) => scopes.activeOnly());
    }
    return ctx.serialize(ItemTransformer.transform(byTitle(await query)));
  }

  async showByIsbn(ctx: HttpContext) {
    const item = await findItemByIsbn(ctx.request.param("isbn"));
    return item === null ? null : { id: item.id, title: item.title };
  }

  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(createItemValidator);
    return ctx.serialize(ItemTransformer.transform(await ItemManagementService.create(input)));
  }

  async update(ctx: HttpContext) {
    const patch = await ctx.request.validateUsing(updateItemValidator);
    const item = await ItemManagementService.update(ctx.request.param("id"), patch);
    return ctx.serialize(ItemTransformer.transform(item));
  }

  async bulkUpsert(ctx: HttpContext) {
    const { items } = await ctx.request.validateUsing(bulkUpsertItemsValidator);
    return ItemManagementService.bulkUpsert(items);
  }
}
