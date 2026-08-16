import { HttpContext } from "@adonisjs/core/http";

import { BranchBooksService, BranchBooksUpdate } from "#services/branch_books_service";
import { PermissionService } from "#services/permission_service";
import {
  activeBooksBulkUpdateValidator,
  branchBooksDetailsValidator,
  orderedBooksBulkUpdateValidator,
  orderedBooksCancelValidator,
} from "#validators/branch_books";

function hasExactlyOneUpdate(update: BranchBooksUpdate) {
  return [update.deadline, update.branchId].filter(Boolean).length === 1;
}

export default class BranchBooksController {
  async getActiveBooks(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return BranchBooksService.getActiveBooksSummary(ctx.request.param("branchId"));
  }

  async getActiveBookDetails(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { deadlines, itemId } = await ctx.request.validateUsing(branchBooksDetailsValidator);
    return BranchBooksService.getActiveBookDetails({
      branchId: ctx.request.param("branchId"),
      deadlines,
      itemId,
    });
  }

  async bulkUpdateActiveBooks(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { filter, update } = await ctx.request.validateUsing(activeBooksBulkUpdateValidator);
    if (!hasExactlyOneUpdate(update) || (!filter.deadlines && !filter.customerItemIds)) {
      return ctx.response.badRequest();
    }
    return BranchBooksService.bulkUpdateActiveBooks({
      branchId: ctx.request.param("branchId"),
      filter,
      update,
    });
  }

  async getOrderedBooks(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return BranchBooksService.getOrderedBooksSummary(ctx.request.param("branchId"));
  }

  async getOrderedBookDetails(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { deadlines, itemId } = await ctx.request.validateUsing(branchBooksDetailsValidator);
    return BranchBooksService.getOrderedBookDetails({
      branchId: ctx.request.param("branchId"),
      deadlines,
      itemId,
    });
  }

  async bulkUpdateOrderedBooks(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { filter, update } = await ctx.request.validateUsing(orderedBooksBulkUpdateValidator);
    if (!hasExactlyOneUpdate(update) || (!filter.deadlines && !filter.orderItemIds)) {
      return ctx.response.badRequest();
    }
    return BranchBooksService.bulkUpdateOrderedBooks({
      branchId: ctx.request.param("branchId"),
      filter,
      update,
    });
  }

  async cancelOrderedBooks(ctx: HttpContext) {
    const { detailsId } = PermissionService.adminOrFail(ctx);
    const { filter, notifyCustomers } = await ctx.request.validateUsing(
      orderedBooksCancelValidator,
    );
    if (!filter.deadlines && !filter.orderItemIds) {
      return ctx.response.badRequest();
    }
    return BranchBooksService.bulkCancelOrderedBooks({
      branchId: ctx.request.param("branchId"),
      filter,
      notifyCustomers,
      employeeDetailsId: detailsId,
    });
  }
}
