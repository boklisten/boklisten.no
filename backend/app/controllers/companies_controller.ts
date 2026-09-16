import type { HttpContext } from "@adonisjs/core/http";

import Company from "#models/company";
import CompanyTransformer from "#transformers/company_transformer";
import { companyValidator } from "#validators/companies_validators";

export default class CompaniesController {
  async store(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(companyValidator);
    return ctx.serialize(CompanyTransformer.transform(await Company.create(input)));
  }

  async index(ctx: HttpContext) {
    return ctx.serialize(CompanyTransformer.transform(await Company.allByName()));
  }

  async destroy(ctx: HttpContext) {
    const company = await Company.findOrFail(ctx.request.param("companyId"));
    await company.delete();
    return ctx.serialize(CompanyTransformer.transform(company));
  }
}
