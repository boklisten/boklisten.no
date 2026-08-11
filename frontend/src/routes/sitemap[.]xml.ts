import { publicApiClient } from "@/shared/utils/publicApiClient";
import { SITE_URL, isIndexable, normalizePathname } from "@/shared/utils/seo";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Indexable, but not content pages worth submitting: both redirect to a
 * query-parameter variant of themselves, which Search Console reports as
 * "page with redirect" when it comes from a sitemap.
 */
const UTILITY_PATHS = new Set(["/auth/login", "/auth/register"]);

/**
 * Every public page the router knows about, so a new page is listed the moment
 * it is opted into indexing — there is no second list to remember to update.
 *
 * The router is imported lazily because this module is itself part of the route
 * tree the router is built from.
 */
async function staticPaths(): Promise<string[]> {
  const { getRouter } = await import("@/router");
  const paths = Object.keys(getRouter().routesByPath)
    .filter((path) => !path.includes("$"))
    .map(normalizePathname)
    .filter((path) => isIndexable(path) && !UTILITY_PATHS.has(path));
  return [...new Set(paths)];
}

/** One page per school, listing when we are on stand there. */
async function branchPaths(): Promise<string[]> {
  try {
    const branches = await publicApiClient.api.branches.getPublic({});
    return branches.map((branch) => `/info/branch/${branch.id}`);
  } catch {
    // A sitemap missing the school pages is far better than no sitemap at all
    return [];
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [staticUrls, branchUrls] = await Promise.all([staticPaths(), branchPaths()]);
        const urls = [...staticUrls, ...branchUrls]
          .map((path) => `  <url><loc>${escapeXml(`${SITE_URL}${path}`)}</loc></url>`)
          .join("\n");

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
          {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=3600",
            },
          },
        );
      },
    },
  },
});
