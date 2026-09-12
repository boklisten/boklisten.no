/** How many books moved through a branch (and its descendants) in one calendar year. */
export interface BranchBookMovementsYear {
  year: number;
  /** Rent, partly-payment and buy order items handed over, at stand or by mail. */
  handedOut: number;
  /**
   * Books that came back: return order items, buybacks (partly-payment books sold back to
   * Boklisten) and cancelled handouts.
   */
  collected: number;
  /** Books that went directly from one student to another, each physical hand-over once. */
  transferred: number;
  /** Books the customer kept: buyout order items plus every book put on an invoice. */
  boughtOut: number;
}

export interface BranchBookMovements {
  /** Every year from the first to the last movement, consecutive, oldest first. */
  years: BranchBookMovementsYear[];
}
