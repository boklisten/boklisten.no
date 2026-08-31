import { BranchCollection } from "#services/legacy/collections/branch/branch.collection";
import { BranchItemCollection } from "#services/legacy/collections/branch-item/branch-item.collection";
import { CompanyCollection } from "#services/legacy/collections/company/company.collection";
import { CustomerItemCollection } from "#services/legacy/collections/customer-item/customer-item.collection";
import { DeliveryCollection } from "#services/legacy/collections/delivery/delivery.collection";
import { InvoiceCollection } from "#services/legacy/collections/invoice/invoice.collection";
import { ItemCollection } from "#services/legacy/collections/item/item.collection";
import { OrderCollection } from "#services/legacy/collections/order/order.collection";
import { PaymentCollection } from "#services/legacy/collections/payment/payment.collection";
import { UniqueItemCollection } from "#services/legacy/collections/unique-item/unique-item.collection";
import { UserDetailCollection } from "#services/legacy/collections/user-detail/user-detail.collection";

const BlCollections = [
  BranchCollection,
  BranchItemCollection,
  CustomerItemCollection,
  DeliveryCollection,
  ItemCollection,
  OrderCollection,
  PaymentCollection,
  UserDetailCollection,
  InvoiceCollection,
  CompanyCollection,
  UniqueItemCollection,
];

export default BlCollections;
