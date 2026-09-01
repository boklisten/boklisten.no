import * as Sentry from "@sentry/tanstackstart-react";

Sentry.init({
  dsn: "https://6ffc45d40e73d726fff078a70929a634@o569888.ingest.us.sentry.io/4508654849294336",
  tracesSampleRate: 0.1,
});
