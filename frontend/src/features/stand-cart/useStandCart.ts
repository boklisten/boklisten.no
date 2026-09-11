import type { Branch } from "@boklisten/backend/shared/branch";
import { futureRentPeriods } from "@boklisten/backend/shared/rent-periods";
import type {
  StandCartChoice,
  StandCartLine,
  StandCartLookup,
  StandCartResolveResult,
  StandCartSource,
} from "@boklisten/backend/shared/stand_cart";
import {
  BLID_REQUIRED_ACTION_TYPES,
  findOption,
  HANDOUT_ACTION_TYPES,
  needsBlid,
  unlinkedBlidMessage,
} from "@boklisten/backend/shared/stand_cart";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { defaultChoice, describeChoice } from "@/features/stand-cart/standCartLabels";
import type {
  StandCartLinkSource,
  StoredCart,
  StoredLine,
} from "@/features/stand-cart/standCartStore";
import { useStandCartGuard } from "@/features/stand-cart/StandCartGuard";
import confirmDropCart from "@/features/stand-cart/confirmDropCart";
import {
  EMPTY_CART,
  forget,
  peekStandCart,
  updateStandCart,
  useStandCartState,
} from "@/features/stand-cart/standCartStore";
import type { ScanNotice } from "@/shared/components/scanner/ScannerPanel";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showSuccessNotification } from "@/shared/utils/notifications";
import { publicApi } from "@/shared/utils/publicApiClient";

/**
 * The first branch from the customer's own and upwards through the tree that has a future rent
 * period: where a book nobody ordered gets its deadline from.
 */
function branchWithPeriods(
  branches: Branch[],
  startBranchId: string | undefined,
  now: Date,
): string | null {
  const byId = new Map(branches.map((branch) => [branch.id, branch]));
  const visited = new Set<string>();
  let current = startBranchId === undefined ? undefined : byId.get(startBranchId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (futureRentPeriods(current, now).length > 0) {
      return current.id;
    }
    current = current.parentBranch === undefined ? undefined : byId.get(current.parentBranch);
  }
  return null;
}

/**
 * A resolved line with the choice it should carry. A copy just scanned for a line that had none
 * opens the hand-out options, which is what the scan meant, so the line takes its new default.
 * Otherwise the previous choice is kept even when the line no longer offers it, so the line asks
 * to be chosen again instead of quietly turning, say, an extension into a return.
 */
function storedLine(line: StandCartLine, previous?: StoredLine): StoredLine {
  const gainedCopy = previous !== undefined && previous.line.blid === null && line.blid !== null;
  return {
    line,
    choice: gainedCopy || previous === undefined ? defaultChoice(line) : previous.choice,
    problem: null,
  };
}

export function lineProblem({ line, choice, problem }: StoredLine): string | null {
  if (problem !== null) {
    return problem;
  }
  if (line.options.length === 0) {
    return line.unavailableReason ?? "Filialen tilbyr ikke denne boka";
  }
  const resolved = findOption(line, choice);
  if (!resolved) {
    return `«${describeChoice(choice, line.source.kind)}» er ikke tilgjengelig lenger, velg på nytt`;
  }
  if (!resolved.available) {
    return resolved.reason ?? "Valget er ikke tilgjengelig";
  }
  if (needsBlid(line.blid, choice.type)) {
    return "Skann bokas unike ID før du går videre";
  }
  return null;
}

/** What the employee sees when the page's guard said no to an add. */
const REFUSED_ADD_MESSAGE = "Boka ble ikke lagt i handlekurven.";

/** Restricts scans to one order, for the order manager, where each shipment is packed alone. */
export interface StandCartScope {
  orderId: string;
}

/**
 * The employee's cart for one customer: lines resolved and priced by the backend, the choices
 * made on them, and the cart branch. Every way of adding a line goes through here, so a click on
 * a row and a scan from any scanner behave the same.
 */
export default function useStandCart(customerId: string | null, scope?: StandCartScope) {
  const { api, client } = useApiClient();
  const cart = useStandCartState(customerId);
  // A page may put a question in front of every add (the Kasse: a waiting Innsamling batch)
  const beforeAdd = useStandCartGuard();
  // Scanner modals capture their callbacks when they open, so those read the live cart here
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const { data: branches } = useQuery(publicApi.branches.getAll.queryOptions());
  const { data: customer } = useQuery(
    api.userDetail.getById.queryOptions(
      { params: { detailsId: customerId ?? "" } },
      { enabled: customerId !== null },
    ),
  );

  function update(change: (cart: StoredCart) => StoredCart): StoredCart {
    if (customerId === null) {
      return cartRef.current;
    }
    const next = updateStandCart(customerId, change);
    cartRef.current = next;
    return next;
  }

  /**
   * Whether a line may be added: the page's guard first (a waiting Innsamling batch), then another
   * customer's cart still holding unpaid lines, which the employee must knowingly give up.
   */
  async function mayAdd(): Promise<boolean> {
    if (!(await beforeAdd())) {
      return false;
    }
    const waiting = peekStandCart();
    if (waiting === null || waiting.customerId === customerId) {
      return true;
    }
    const confirmed = await confirmDropCart({
      customerName: waiting.cart.customerName,
      lineCount: waiting.cart.lines.length,
      destination: "cart",
    });
    if (confirmed) {
      forget();
    }
    return confirmed;
  }

  /** The branch a resolve is priced from: the cart's, else the customer's own with periods. */
  function provisionalBranchId(): string | null {
    return (
      cartRef.current.branchId ??
      branchWithPeriods(branches ?? [], customer?.branchMembership, new Date()) ??
      branches?.[0]?.id ??
      null
    );
  }

  async function resolve(
    source: StandCartLookup,
    branchId: string,
    extra: { blid?: string; takenKeys?: string[] } = {},
  ): Promise<StandCartResolveResult> {
    if (customerId === null) {
      return { kind: "refused", message: "Velg en kunde først" };
    }
    try {
      return await client.api.standCart.resolveLine({
        body: { customerId, branchId, source, ...extra },
      });
    } catch (error) {
      return {
        kind: "refused",
        message: errorMessage(error, "Klarte ikke legge boka i handlekurven"),
      };
    }
  }

  /**
   * Puts a resolved line in the cart, taking the branch from the first line when none is set.
   * A scan gets a toast, since the scanner gives no other feedback; a click on a row already
   * shows its button flip and the cart bar update.
   */
  async function accept(
    line: StandCartLine,
    branchId: string,
    { notify }: { notify: boolean },
  ): Promise<ScanNotice | undefined> {
    // An empty cart takes its branch from the line being added, whatever branch it last used
    const held = cartRef.current;
    const naturalBranchId =
      (held.lines.length > 0 ? held.branchId : null) ?? line.originalBranch?.id ?? branchId;
    if (naturalBranchId !== branchId) {
      // Priced from a provisional branch; price it again from the branch the cart will use
      const again = await resolve(
        line.source,
        naturalBranchId,
        line.blid === null ? {} : { blid: line.blid },
      );
      if (again.kind !== "line") {
        return {
          message: again.kind === "refused" ? again.message : unlinkedBlidMessage(again.blid),
        };
      }
      line = again.line;
    }
    update((current) => ({
      ...current,
      branchId: naturalBranchId,
      customerName: current.customerName ?? customer?.name ?? null,
      lines: [
        ...current.lines.filter((stored) => stored.line.key !== line.key),
        storedLine(
          line,
          current.lines.find((stored) => stored.line.key === line.key),
        ),
      ],
    }));
    if (notify) {
      showSuccessNotification(`«${line.title}» er lagt i handlekurven`);
    }
    return undefined;
  }

  async function add(source: StandCartSource): Promise<ScanNotice | undefined> {
    if (!(await mayAdd())) {
      return { message: REFUSED_ADD_MESSAGE };
    }
    const branchId = provisionalBranchId();
    if (branchId === null) {
      return { message: "Fant ingen filial å legge boka på" };
    }
    const result = await resolve(source, branchId);
    if (result.kind === "refused") {
      return { message: result.message };
    }
    if (result.kind === "unlinked") {
      return { message: unlinkedBlidMessage(result.blid) };
    }
    return accept(result.line, branchId, { notify: false });
  }

  /**
   * A scanned copy: the backend says which line it is. Order lines that already carry a blid are
   * taken, so a second copy of the same title becomes its own line; a blid-less order line is
   * filled in. A sticker on no book yet starts a link step in the scanner it came from.
   */
  async function addBlid(blid: string, via: StandCartLinkSource): Promise<ScanNotice | undefined> {
    // Asked before any lookup, so no link step ever starts against a waiting list
    if (!(await mayAdd())) {
      return { message: REFUSED_ADD_MESSAGE };
    }
    const branchId = provisionalBranchId();
    if (branchId === null) {
      return { message: "Fant ingen filial å legge boka på" };
    }
    if (cartRef.current.lines.some((stored) => stored.line.blid === blid)) {
      return {
        title: "Allerede i handlekurven",
        message: `Unik ID ${blid} ligger allerede i handlekurven.`,
      };
    }
    const takenKeys = cartRef.current.lines
      .filter((stored) => stored.line.blid !== null)
      .map((stored) => stored.line.key);
    const result = await resolve({ kind: "blid", blid }, branchId, { takenKeys });
    if (result.kind === "refused") {
      return { message: result.message };
    }
    if (result.kind === "unlinked") {
      update((current) => ({ ...current, linking: { blid, via, candidate: null } }));
      return undefined;
    }
    const offScope = scopeNotice(result.line);
    if (offScope !== undefined) {
      return offScope;
    }
    return accept(result.line, branchId, { notify: true });
  }

  /**
   * Under an order scope, a copy the backend placed anywhere but on that order stays out of the
   * cart: the same title on another order, or a book nobody ordered, must not ship with this one.
   */
  function scopeNotice(line: StandCartLine): ScanNotice | undefined {
    if (scope === undefined) {
      return undefined;
    }
    if (line.source.kind === "order" && line.source.orderId === scope.orderId) {
      return undefined;
    }
    const alreadyFromOrder = cartRef.current.lines.some(
      (stored) =>
        stored.line.itemId === line.itemId &&
        stored.line.source.kind === "order" &&
        stored.line.source.orderId === scope.orderId,
    );
    return {
      title: "Ikke på denne bestillingen",
      message: alreadyFromOrder
        ? `«${line.title}» fra bestillingen ligger allerede i handlekurven. Bestillingen har ikke flere eksemplarer.`
        : `«${line.title}» er ikke på bestillingen du har valgt.`,
    };
  }

  /** The ISBN scanned for the blid waiting to be linked: looks the title up for the employee's yes. */
  async function proposeLink(isbn: string): Promise<ScanNotice | undefined> {
    if (cartRef.current.linking === null) {
      return { message: "Ingen unik ID venter på kobling" };
    }
    const item = await client.api.items.getByIsbn({ params: { isbn } });
    if (!item) {
      return {
        title: "Ukjent ISBN",
        message: `Fant ingen bok med ISBN ${isbn}. Sjekk at du skannet riktig strekkode.`,
      };
    }
    update((current) =>
      current.linking === null
        ? current
        : { ...current, linking: { ...current.linking, candidate: { isbn, title: item.title } } },
    );
    return undefined;
  }

  /** Links the blid to the confirmed title, then puts the copy in the cart as if it always was. */
  async function confirmLink(): Promise<ScanNotice | undefined> {
    const { linking } = cartRef.current;
    if (linking === null || linking.candidate === null) {
      return { message: "Ingen kobling å bekrefte" };
    }
    const connection = await client.api.uniqueItems.add({
      body: { blid: linking.blid, isbn: linking.candidate.isbn },
    });
    if (connection.feedback) {
      return { message: connection.feedback };
    }
    update((current) => ({ ...current, linking: null }));
    return addBlid(linking.blid, linking.via);
  }

  /** Back to scanning the ISBN, for a candidate that was the wrong book. */
  function retryLink(): void {
    update((current) =>
      current.linking === null
        ? current
        : { ...current, linking: { ...current.linking, candidate: null } },
    );
  }

  /** Drops the link step; only the scanner it started in may end it. */
  function cancelLink(via: StandCartLinkSource): void {
    update((current) => (current.linking?.via === via ? { ...current, linking: null } : current));
  }

  function remove(key: string): void {
    update((current) => {
      const lines = current.lines.filter((stored) => stored.line.key !== key);
      // The branch belongs to the lines; the next line added sets it again
      return { ...current, lines, branchId: lines.length === 0 ? null : current.branchId };
    });
  }

  function choose(key: string, choice: StandCartChoice): void {
    update((current) => ({
      ...current,
      lines: current.lines.map((stored) =>
        stored.line.key === key ? { ...stored, choice } : stored,
      ),
    }));
  }

  /** What the employee sees of a line: its choice, what that costs, and whether it can go through. */
  function fingerprint(stored: StoredLine): string {
    return [
      stored.line.key,
      stored.choice.type,
      stored.choice.to ?? "",
      findOption(stored.line, stored.choice)?.price ?? "",
      lineProblem(stored) ?? "",
    ].join("|");
  }

  /**
   * Prices every line again from the given branch; lines that no longer hold are flagged.
   * Resolves to whether anything the employee sees changed.
   */
  async function reprice(branchId: string): Promise<boolean> {
    const before = cartRef.current.lines.map(fingerprint).join("\n");
    const lines = await Promise.all(
      cartRef.current.lines.map(async (stored): Promise<StoredLine> => {
        const result = await resolve(
          stored.line.source,
          branchId,
          stored.line.blid === null ? {} : { blid: stored.line.blid },
        );
        if (result.kind === "line") {
          return storedLine(result.line, stored);
        }
        return {
          line: stored.line,
          choice: stored.choice,
          problem: result.kind === "refused" ? result.message : unlinkedBlidMessage(result.blid),
        };
      }),
    );
    update((current) => ({ ...current, branchId, lines }));
    return lines.map(fingerprint).join("\n") !== before;
  }

  const refresh = () => (cart.branchId === null ? Promise.resolve(false) : reprice(cart.branchId));

  function clear(): void {
    update(() => EMPTY_CART);
  }

  const priced = cart.lines.map((stored) => ({
    line: stored.line,
    choice: stored.choice,
    problem: lineProblem(stored),
    resolved: findOption(stored.line, stored.choice),
  }));
  const total = priced.reduce((sum, { resolved }) => sum + (resolved?.price ?? 0), 0);
  const payLater = priced.reduce((sum, { resolved }) => sum + (resolved?.payLater ?? 0), 0);
  // No money in play, no price column and no total: a free handout is not a purchase
  const hasPrice = priced.some(
    ({ resolved }) => resolved !== null && (resolved.price !== 0 || (resolved.payLater ?? 0) > 0),
  );
  const problems = priced.filter((stored) => stored.problem !== null);
  const handoutLines = priced.filter(({ choice }) => HANDOUT_ACTION_TYPES.includes(choice.type));

  return {
    cart,
    lines: priced,
    branch: branches?.find((branch) => branch.id === cart.branchId) ?? null,
    branches: branches ?? [],
    total,
    payLater,
    /** Whether any line costs or refunds something, so the sums are worth showing at all. */
    hasPrice,
    problems,
    /** Handouts due from another student, which the employee must knowingly override. */
    peerNotes: handoutLines.flatMap(({ line }) =>
      line.notes.filter((note) => note.kind === "peer-match"),
    ),
    /** Loans handed out, for which the customer's signature matters. */
    hasLoanHandout: handoutLines.some(({ choice }) =>
      BLID_REQUIRED_ACTION_TYPES.includes(choice.type),
    ),
    /** Books going out from a mail order; only they raise the question of how they get there. */
    hasBringDelivery: handoutLines.some(({ line }) =>
      line.notes.some((note) => note.kind === "bring-delivery"),
    ),
    isEmpty: cart.lines.length === 0,
    has: (key: string) => cart.lines.some((stored) => stored.line.key === key),
    add,
    addBlid,
    remove,
    choose,
    setBranch: reprice,
    refresh,
    clear,
    proposeLink,
    confirmLink,
    retryLink,
    cancelLink,
  };
}

export type StandCart = ReturnType<typeof useStandCart>;
