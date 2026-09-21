/**
 * Build-time facts about where this frontend runs, filled in by `vite.config.ts`: on Railway from
 * the environment's name and the API service's domain, locally with the dev defaults.
 */
export const APP_ENV: string = import.meta.env.VITE_APP_ENV;
export const API_URL: string = import.meta.env.VITE_API_URL;

export function isProduction() {
  return APP_ENV === "production";
}

/**
 * Where this runtime calls the API. Pages rendered on Railway's server use the API's private
 * domain, set as a reference variable in `.railway/railway.ts`: plain HTTP inside the project's
 * encrypted network, on the port the API listens on by default. The browser, and the dev server,
 * use the public URL. Only the server bundle has `process`, so it is not touched elsewhere.
 */
export const API_BASE_URL: string =
  typeof window === "undefined" && process.env["API_PRIVATE_DOMAIN"]
    ? `http://${process.env["API_PRIVATE_DOMAIN"]}:3333`
    : API_URL;
