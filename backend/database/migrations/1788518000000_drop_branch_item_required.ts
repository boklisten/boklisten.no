import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * `branchItem.required` was never used: no reader or writer exists in this repo, bl-admin, or
 * bl-cron, and exactly one document (staging, 2026-08-31) carried the field. The schema and the
 * shared BranchItem type no longer declare it; this removes the stray value from the data.
 */
export default class extends BaseSchema {
  override async up() {
    // Changed MongoDB only; emptied when MongoDB was decommissioned (2026-09-28).
  }

  override async down() {
    // Removal of a dead field; there is nothing sensible to revert to.
  }
}
