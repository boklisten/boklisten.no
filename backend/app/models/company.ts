import { beforeCreate } from "@adonisjs/lucid/orm";

import { assignObjectId } from "#models/helpers/object_id";
import { CompanySchema } from "#database/schema";

/**
 * A company we invoice by hand (a school or municipality buying books outright); see
 * `shared/company.ts` for the field semantics.
 */
export default class Company extends CompanySchema {
  static override selfAssignPrimaryKey = true;

  @beforeCreate()
  static assignId(company: Company) {
    assignObjectId(company);
  }

  /** Every company, sorted the way Norwegians read names (Æ, Ø and Å after Z). */
  static async allByName(): Promise<Company[]> {
    const companies = await this.all();
    return companies.toSorted((a, b) => a.name.localeCompare(b.name, "nb"));
  }
}
