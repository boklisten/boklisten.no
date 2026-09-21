import { defineConfig } from "@adonisjs/shield";

import { isDeployed } from "#config/app";

// CSRF and CSP are left at Shield's disabled default: CSRF is handled by verify_origin_middleware,
// and the API serves only JSON so a page-level CSP adds nothing.
const shieldConfig = defineConfig({
  xFrame: {
    enabled: true,
    action: "DENY",
  },
  hsts: {
    enabled: isDeployed,
    maxAge: "365 days",
    includeSubDomains: true,
  },
  contentTypeSniffing: {
    enabled: true,
  },
});

export default shieldConfig;
