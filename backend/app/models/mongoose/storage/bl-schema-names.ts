export const BlSchemaName = {
  Branches: "branches",
  BranchItems: "branchitems",
  Companies: "companies",
  CustomerItems: "customeritems",
  Deliveries: "deliveries",
  Invoices: "invoices",
  Items: "items",
  Orders: "orders",
  Payments: "payments",
  UniqueItems: "uniqueitems",
  Users: "users",
  UserDetails: "userdetails",
} as const satisfies Record<string, string>;
