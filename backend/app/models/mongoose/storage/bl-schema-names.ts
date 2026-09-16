export const BlSchemaName = {
  CustomerItems: "customeritems",
  Deliveries: "deliveries",
  Invoices: "invoices",
  Orders: "orders",
  Payments: "payments",
  UniqueItems: "uniqueitems",
  Users: "users",
  UserDetails: "userdetails",
} as const satisfies Record<string, string>;
