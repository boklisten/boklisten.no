import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * `branch_subjects.external_name` becomes optional: a subject without one is matched on its name
 * when subject choices are uploaded. Rows whose external name only repeats the name (everything
 * "Importer fra bøker" made) are cleared.
 *
 * The unique index moves from `lower(external_name)` to the upload key,
 * `lower(coalesce(external_name, name))`, so two subjects never match the same CSV subject. The old
 * index on external names plus the one on names already rule out every clash the new one would
 * find, so no row breaks it. `down()` copies the name back into the cleared rows.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.raw(`alter table branch_subjects alter column external_name drop not null`);
    this.schema.raw(
      `update branch_subjects set external_name = null, updated_at = now()
       where external_name = name`,
    );
    this.schema.raw(`drop index branch_subjects_branch_external_name_unique`);
    this.schema.raw(
      `create unique index branch_subjects_branch_upload_name_unique
       on branch_subjects (branch_id, lower(coalesce(external_name, name)))`,
    );
  }

  override async down() {
    this.schema.raw(`drop index branch_subjects_branch_upload_name_unique`);
    this.schema.raw(`update branch_subjects set external_name = name where external_name is null`);
    this.schema.raw(`alter table branch_subjects alter column external_name set not null`);
    this.schema.raw(
      `create unique index branch_subjects_branch_external_name_unique
       on branch_subjects (branch_id, lower(external_name))`,
    );
  }
}
