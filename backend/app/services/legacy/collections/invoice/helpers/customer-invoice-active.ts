import { InvoiceActive } from "#services/legacy/collections/invoice/helpers/invoice-active";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Invoice } from "#shared/invoice";

export class CustomerInvoiceActive {
  private readonly queryBuilder = new SEDbQueryBuilder();
  private readonly invoiceActive = new InvoiceActive();

  public async haveActiveInvoices(userId: string): Promise<boolean> {
    const databaseQuery = this.queryBuilder.getDbQuery({ "customerInfo.userDetail": userId }, [
      { fieldName: "customerInfo.userDetail", type: "object-id" },
    ]);
    let invoices: Invoice[];
    try {
      invoices = await StorageService.Invoices.getByQuery(databaseQuery);
    } catch (error) {
      if (error instanceof BlError && error.getCode() == 702) {
        return false;
      }
    }

    // @ts-expect-error fixme: auto ignored
    return invoices.some((invoice) => this.invoiceActive.isActive(invoice));
  }
}
