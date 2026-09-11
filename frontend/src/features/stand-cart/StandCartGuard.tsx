import { createContext, useContext } from "react";
import type { ReactNode } from "react";

type BeforeAdd = () => Promise<boolean>;

const allow: BeforeAdd = () => Promise.resolve(true);

const StandCartGuardContext = createContext<BeforeAdd>(allow);

/**
 * Lets a page put a question in front of every way of adding to the cart: a scan, a search pick,
 * a row button. The Kasse uses it to ask before a book goes into a cart while the Innsamling
 * batch has undelivered books, since the two lists may not coexist. Pages without a provider
 * (the order manager) add without asking.
 */
export default function StandCartGuard({
  beforeAdd,
  children,
}: {
  /** Resolves to false to refuse the add; runs before anything is looked up. */
  beforeAdd: BeforeAdd;
  children: ReactNode;
}) {
  return (
    <StandCartGuardContext.Provider value={beforeAdd}>{children}</StandCartGuardContext.Provider>
  );
}

export function useStandCartGuard(): BeforeAdd {
  return useContext(StandCartGuardContext);
}
