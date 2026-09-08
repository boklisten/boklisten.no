import type { OrderManagerFilter } from "@boklisten/backend/shared/order_manager";
import type { SearchSchemaInput } from "@tanstack/react-router";

const OBJECT_ID_PATTERN = /^[\da-f]{24}$/i;

/** What a link may pass; every part is optional. */
export interface OrderManagerSearchInput {
  /** The selected order. */
  ordre?: string;
  /** Order branches to show, as the tree picker gives them (parents and all their descendants). */
  filialer?: string[];
  /** Only orders that are to be sent by mail. */
  bring?: boolean;
}

/** The same, with the defaults filled in, for the page. */
export interface OrderManagerSearchParams {
  ordre: string | undefined;
  filialer: string[];
  bring: boolean;
}

/**
 * Anything can be pasted into the URL, so every part is checked before the page trusts it. Only
 * what is set is kept, so the URL never grows empty defaults; the page fills those in.
 */
export function validateOrderManagerSearch(
  search: OrderManagerSearchInput & SearchSchemaInput,
): OrderManagerSearchInput {
  const untrusted: Partial<Record<keyof OrderManagerSearchInput, unknown>> = search;
  const ordre = untrusted["ordre"];
  const filialer = (Array.isArray(untrusted["filialer"]) ? untrusted["filialer"] : []).filter(
    (id): id is string => typeof id === "string" && OBJECT_ID_PATTERN.test(id),
  );
  return toOrderManagerSearch({
    ordre: typeof ordre === "string" && OBJECT_ID_PATTERN.test(ordre) ? ordre : undefined,
    filialer,
    bring: untrusted["bring"] === true,
  });
}

export function readOrderManagerSearch(search: OrderManagerSearchInput): OrderManagerSearchParams {
  return { ordre: search.ordre, filialer: search.filialer ?? [], bring: search.bring ?? false };
}

/** The search as a link should carry it: no empty or default parts. */
export function toOrderManagerSearch(params: OrderManagerSearchParams): OrderManagerSearchInput {
  return {
    ...(params.ordre === undefined ? {} : { ordre: params.ordre }),
    ...(params.filialer.length === 0 ? {} : { filialer: params.filialer }),
    ...(params.bring ? { bring: true } : {}),
  };
}

/** The filter the list and the downloads send; unset parts are left out so the API sees defaults. */
export function toOrderManagerFilter(params: OrderManagerSearchParams): OrderManagerFilter {
  return {
    ...(params.filialer.length > 0 ? { branchIds: params.filialer } : {}),
    ...(params.bring ? { bringOnly: true } : {}),
  };
}
