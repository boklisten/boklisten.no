import { BaseTransformer } from "@adonisjs/core/transformers";

import type Company from "#models/company";
import type { Company as CompanyDto } from "#shared/company";

export default class CompanyTransformer extends BaseTransformer<Company> {
  toObject(): CompanyDto {
    return this.pick(this.resource, [
      "id",
      "name",
      "phone",
      "email",
      "address",
      "postCode",
      "postCity",
      "customerNumber",
      "organizationNumber",
    ]);
  }
}
