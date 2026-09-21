/**
 * Build-time facts about where this frontend runs, filled in by `vite.config.ts`: on Railway from
 * the environment's name and the API service's domain, locally with the dev defaults.
 */
export const APP_ENV: string = import.meta.env.VITE_APP_ENV;
export const API_URL: string = import.meta.env.VITE_API_URL;

export function isProduction() {
  return APP_ENV === "production";
}

export const API_BASE_URL: string =
  typeof window === "undefined" && process.env["API_PRIVATE_URL"]
    ? process.env["API_PRIVATE_URL"]
    : API_URL;
