import { InvoiceLineSchema } from "#database/schema";
import type { InvoiceLine as InvoiceLineDto } from "#shared/invoice";
import type { CustomerItemType } from "#shared/customer-item/customer-item-type";

/**
 * One line of an invoice (see `shared/invoice.ts` for the field semantics). Lines are read through
 * `Invoice`, which loads them in `position` order.
 */
export default class InvoiceLine extends InvoiceLineSchema {
  declare customerItemType: CustomerItemType | null;

  toDto(): InvoiceLineDto {
    return {
      customerItemId: this.customerItemId,
      itemId: this.itemId,
      customerItemType: this.customerItemType,
      title: this.title,
      productNumber: this.productNumber,
      numberOfItems: this.numberOfItems,
      cancel: this.cancel,
      unit: this.unit,
      gross: this.gross,
      net: this.net,
      vat: this.vat,
      discount: this.discount,
    };
  }
}
