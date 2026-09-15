import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import { useState } from "react";

/** Nasjonalbiblioteket's public catalogue: every book published in Norway is deposited there. */
const NB_ITEMS_URL = "https://api.nb.no/catalog/v1/items";
const REQUEST_TIMEOUT_MS = 8000;

export type Isbn = string | number | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * The record that carries the ISBN itself and has a public thumbnail. A free-text search can
 * surface other records that mention the number, so only an exact ISBN match is trusted.
 */
function findCoverUrl(body: unknown, isbn: string): string | null {
  const embedded = isRecord(body) ? body["_embedded"] : undefined;
  const items = isRecord(embedded) ? embedded["items"] : undefined;
  if (!Array.isArray(items)) {
    return null;
  }
  for (const item of items) {
    if (!isRecord(item) || !isRecord(item["metadata"]) || !isRecord(item["_links"])) {
      continue;
    }
    const identifiers = item["metadata"]["identifiers"];
    const isbn13 = isRecord(identifiers) ? identifiers["isbn13"] : undefined;
    if (!Array.isArray(isbn13) || !isbn13.includes(isbn)) {
      continue;
    }
    // Only the small renditions are public for copyrighted books.
    const thumbnail = item["_links"]["thumbnail_large"];
    const href = isRecord(thumbnail) ? thumbnail["href"] : undefined;
    if (typeof href === "string") {
      return href;
    }
  }
  return null;
}

/** Purely cosmetic, so every failure (offline, rejected, unexpected body) is a null, never a throw. */
async function fetchBookCoverUrl(isbn: string, signal: AbortSignal): Promise<string | null> {
  try {
    const url = new URL(NB_ITEMS_URL);
    url.searchParams.set("q", isbn);
    url.searchParams.set("size", "5");
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    return findCoverUrl(body, isbn);
  } catch {
    return null;
  }
}

export function bookCoverQueryOptions(isbn: Isbn) {
  const key = isbn === null || isbn === undefined || isbn === "" ? null : String(isbn);
  return queryOptions({
    queryKey: ["book-cover", key],
    queryFn: key === null ? skipToken : ({ signal }) => fetchBookCoverUrl(key, signal),
    // A cover does not change during a session, and a miss is not worth asking about again.
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}

/**
 * The cover as an image source with its error handler. `src` is null while loading, when there is
 * no ISBN or no cover on file, and after the image itself failed to load.
 */
export function useBookCoverImage(isbn: Isbn): { src: string | null; onError: () => void } {
  const url = useQuery(bookCoverQueryOptions(isbn)).data ?? null;
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  return { src: url !== null && url !== brokenUrl ? url : null, onError: () => setBrokenUrl(url) };
}
