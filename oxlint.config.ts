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
    suspicious: "error",
  },
  rules: {
    // fixme: remove these to improve linting
    "@typescript-eslint/unbound-method": "off",
    "@typescript-eslint/no-base-to-string": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    // Obsolete with the automatic JSX transform (React 17+)
    "react/react-in-jsx-scope": "off",
    // Type-aware analysis trusts the Mongoose schema types, but legacy Mongo documents hold
    // numbers/ObjectIds where the schema says string — the "redundant" String()/toString()
    // conversions it wants removed are load-bearing at runtime
    "typescript/no-unnecessary-type-conversion": "off",
    // Render callbacks passed as props (ag-grid cellRenderer etc.) are not mounted as
    // component types, so recreating them per render is fine
    "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
    // Underscore-prefixed members (Mongo `_id`) are idiomatic in this codebase
    "no-underscore-dangle": "off",
    // Legitimate side-effect imports: stylesheets, dayjs locale, TS/DI runtime hooks
    "import/no-unassigned-import": [
      "error",
      {
        allow: [
          "**/*.css",
          "dayjs/locale/*",
          "@/shared/utils/dayjs",
          "@poppinss/ts-exec",
          "reflect-metadata",
        ],
      },
    ],
  },
  ignorePatterns: [".adonisjs", "database/schema.ts", "openapi"],
});
