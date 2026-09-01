import type { HttpContext } from "@adonisjs/core/http";

import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { companyValidator } from "#validators/companies_validators";

export default class CompaniesController {
  async addCompany(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { name, organizationNumber, customerNumber, contactInfo } =
      await ctx.request.validateUsing(companyValidator);
    return await StorageService.Companies.add({
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
  async getCompanies(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return (await StorageService.Companies.getAll()).toSorted((a, b) =>
      a.name.localeCompare(b.name),
    );
  }
  async deleteCompany(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return await StorageService.Companies.remove(ctx.request.param("companyId"));
  }
}
