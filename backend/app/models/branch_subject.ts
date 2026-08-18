import { hasMany } from "@adonisjs/lucid/orm";
import type { HasMany } from "@adonisjs/lucid/types/relations";

import { BranchSubjectSchema } from "#database/schema";
import BranchSubjectBook from "#models/branch_subject_book";

export default class BranchSubject extends BranchSubjectSchema {
  @hasMany(() => BranchSubjectBook, { foreignKey: "branchSubjectId" })
  declare books: HasMany<typeof BranchSubjectBook>;
}
