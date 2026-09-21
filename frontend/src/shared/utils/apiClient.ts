import { createTuyau } from "@tuyau/core/client";
import { registry } from "@boklisten/backend/registry";
import { superjson } from "@tuyau/superjson/plugin";
import { createTuyauReactQueryClient } from "@tuyau/react-query";

import { API_URL } from "@/shared/utils/env";

/** The session cookie is the credential, so every request simply carries the browser's cookies. */
export const apiClient = createTuyau({
  baseUrl: API_URL,
  registry,
  headers: { Accept: "application/json" },
  timeout: 60_000,
  credentials: "include",
  plugins: [superjson()],
});

export const api = createTuyauReactQueryClient({ client: apiClient });
