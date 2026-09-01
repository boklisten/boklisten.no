import { SITE_URL } from "@/shared/utils/seo";
import { isProduction } from "@/shared/utils/env";
import { createFileRoute } from "@tanstack/react-router";

const productionRobots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /kasse
Disallow: /health

Sitemap: ${SITE_URL}/sitemap.xml
`;

const stagingRobots = `User-agent: *
Disallow: /
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(isProduction() ? productionRobots : stagingRobots, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
