import { defineConfig } from "oxlint";

export default defineConfig({
  options: {
    typeAware: true,
    typeCheck: true,
  },
  plugins: [
    "eslint",
    "typescript",
    "unicorn",
    "react",
    "react-perf",
    "oxc",
    "import",
    "jsx-a11y",
    "promise",
  ],
  // TODO: enable more categories for better linting
  categories: {
    correctness: "error",
  },
  rules: {
    // fixme: remove these to improve linting
    "@typescript-eslint/unbound-method": "off",
    "@typescript-eslint/no-base-to-string": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
  },
  ignorePatterns: [".adonisjs", "database/schema.ts", "openapi"],
});
