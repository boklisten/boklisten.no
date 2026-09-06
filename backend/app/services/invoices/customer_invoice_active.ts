import { InvoiceActive } from "#services/invoices/invoice_active";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Invoice } from "#shared/invoice";

export class CustomerInvoiceActive {
  private readonly invoiceActive = new InvoiceActive();

  public async haveActiveInvoices(userId: string): Promise<boolean> {
    const databaseQuery = new SEDbQuery();
    databaseQuery.objectIdFilters = [{ fieldName: "customerInfo.userDetail", value: userId }];
    let invoices: Invoice[];
    try {
      invoices = await StorageService.Invoices.getByQuery(databaseQuery);
    } catch (error) {
      if (error instanceof BlError && error.getCode() === 702) {
        return false;
      }
    }

    // @ts-expect-error fixme: auto ignored
    return invoices.some((invoice) => this.invoiceActive.isActive(invoice));
  }
}
