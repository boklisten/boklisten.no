import { belongsTo } from "@adonisjs/lucid/orm";
import type { BelongsTo } from "@adonisjs/lucid/types/relations";

import { BranchSubjectBookSchema } from "#database/schema";
import BranchSubject from "#models/branch_subject";

export default class BranchSubjectBook extends BranchSubjectBookSchema {
  @belongsTo(() => BranchSubject, { foreignKey: "branchSubjectId" })
  declare subject: BelongsTo<typeof BranchSubject>;
}
