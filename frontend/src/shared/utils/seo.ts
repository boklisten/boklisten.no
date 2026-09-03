import { isProduction } from "@/shared/utils/env";

export const SITE_URL = "https://boklisten.no";
export const SITE_NAME = "Boklisten.no";
export const OG_IMAGE_PATH = "/images/og-image.png";

const INDEXABLE_PATHS = new Set(["/", "/auth/login", "/auth/register", "/bestilling", "/bokflyt"]);
const INDEXABLE_PATH_PREFIXES = ["/info"];

const LAYOUT_ONLY_PATHS = new Set(["/info", "/info/policies"]);

/** Strips the query and any trailing slash, so every URL has exactly one form. */
export function normalizePathname(pathname: string): string {
  const path = (pathname.split("?")[0] ?? "/").replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

export function isIndexable(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (LAYOUT_ONLY_PATHS.has(path)) {
    return false;
  }
  return (
    INDEXABLE_PATHS.has(path) ||
    INDEXABLE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  );
}

export function absoluteUrl(pathname: string): string {
  return `${SITE_URL}${normalizePathname(pathname)}`;
}

export function jsonLdScript(schema: Record<string, unknown>) {
  return {
    type: "application/ld+json",
    children: JSON.stringify(schema),
  };
}

/**
 * The tags that depend on which URL is being served: the canonical link, its
 * Open Graph twin, and the robots directive.
 *
 * These are emitted once by the root route, using the deepest matched pathname,
 * for two reasons. A page can never end up indexable or self-canonical by
 * accident, and — less obviously — page routes are left free of the head
 * context: reading `ctx` inside `head` makes TypeScript give up on inferring
 * that route's `validateSearch`, and silently widens its search params to `{}`.
 */
export function urlDependentHead(ctx: { matches: readonly { pathname: string }[] }) {
  const pathname = ctx.matches.at(-1)?.pathname ?? "/";
  const canonical = absoluteUrl(pathname);
  const indexable = isProduction() && isIndexable(pathname);

  return {
    meta: [
      { name: "robots", content: indexable ? "index, follow" : "noindex, follow" },
      { property: "og:url", content: canonical },
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}

interface SeoOptions {
  title: string;
  description?: string;
  /** Absolute URL. Defaults to the site-wide share image. */
  image?: string;
}

/**
 * Every page-level meta tag: title, description, Open Graph and Twitter cards.
 * Canonical URL and robots directive come from {@link urlDependentHead}.
 *
 * Meta descriptions must be `{ name, content }` — TanStack spreads these keys
 * straight onto the `<meta>` element, so a bare `{ description }` silently
 * renders an attribute no crawler reads.
 */
export function seo({ title, description, image }: SeoOptions) {
  const shareImage = image ?? `${SITE_URL}${OG_IMAGE_PATH}`;

  return {
    meta: [
      { title },
      ...(description ? [{ name: "description", content: description }] : []),

      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "nb_NO" },
      { property: "og:title", content: title },
      { property: "og:image", content: shareImage },
      ...(description ? [{ property: "og:description", content: description }] : []),

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:image", content: shareImage },
      ...(description ? [{ name: "twitter:description", content: description }] : []),
    ],
  };
}
