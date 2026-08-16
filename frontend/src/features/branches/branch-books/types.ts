import { Route } from "@tuyau/core/types";

export type BranchBooksSummary = Route.Response<"branch_books.get_active_books">;
export type BranchBooksGroup = BranchBooksSummary["groups"][number];
export type BranchBooksTitle = BranchBooksGroup["titles"][number];

export type ActiveBookDetail = Route.Response<"branch_books.get_active_book_details">[number];
export type OrderedBookDetail = Route.Response<"branch_books.get_ordered_book_details">[number];

export type BranchBooksEditKind = "deadline" | "branch" | "cancel";

export interface BranchBooksEditTarget {
  description: string;
  filter: {
    deadlines?: string[];
    itemId?: string;
    /** customerItemIds for active books, orderItemIds for ordered books */
    ids?: string[];
  };
  direct: number;
  total: number;
  /** Leaf targets are always direct-only, so the descendant toggle is hidden */
  allowDescendants: boolean;
}

export interface BranchBooksDetailColumn<TDetail> {
  header: string;
  render: (row: TDetail) => React.ReactNode;
}
