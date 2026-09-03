export type CustomerItemStatus =
  | { type: "returned"; text: "Returnert" }
  | { type: "buyout"; text: "Kjøpt ut" }
  | { type: "active"; text: "Aktiv" }
  | { type: "overdue"; text: "Fristen har utløpt" };

interface CustomerItemActionBase {
  /** False when a rule blocks the action; `tooltip` then says why. */
  available: boolean;
  price: number;
  tooltip: string;
  label: string;
}

/** What a customer (or an employee on their behalf) can do with a book they are holding. */
export type CustomerItemAction =
  | (CustomerItemActionBase & { type: "buyout" })
  | (CustomerItemActionBase & { type: "extend"; to?: Date });
