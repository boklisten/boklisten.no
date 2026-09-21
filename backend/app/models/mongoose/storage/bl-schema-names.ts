export const BlSchemaName = {
  CustomerItems: "customeritems",
  Deliveries: "deliveries",
  Invoices: "invoices",
  Orders: "orders",
  Payments: "payments",
  UniqueItems: "uniqueitems",
} as const satisfies Record<string, string>;
