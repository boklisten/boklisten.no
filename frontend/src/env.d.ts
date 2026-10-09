/** Filled in by the `define` block in `vite.config.ts`, never by `.env` files. */
interface ImportMetaEnv {
  readonly VITE_APP_ENV: "dev" | "staging" | "production";
  readonly VITE_API_URL: string;
}

/** WebOTP (Chrome on Android): reads a code from an SMS that ends in `@<host> #<code>`. */
interface CredentialRequestOptions {
  otp?: { transport: "sms"[] };
}
