import type { HttpContext } from "@adonisjs/core/http";

import { StorageService } from "#services/storage_service";
import { companyValidator } from "#validators/companies_validators";

export default class CompaniesController {
  async store(ctx: HttpContext) {
    const { name, organizationNumber, customerNumber, contactInfo } =
      await ctx.request.validateUsing(companyValidator);
    return StorageService.Companies.add({
      name,
      organizationNumber,
      customerNumber,
      contactInfo: {
        phone: contactInfo.phone,
        email: contactInfo.email,
        address: contactInfo.address,
        postCode: contactInfo.postal.code,
        postCity: contactInfo.postal.city,
      },
    });
  }
  async index() {
    return (await StorageService.Companies.getAll()).toSorted((a, b) =>
      a.name.localeCompare(b.name),
    );
  }
  async destroy(ctx: HttpContext) {
    return StorageService.Companies.remove(ctx.request.param("companyId"));
  }
}
