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
    style: "error",
  },
  rules: {
    // --- Style category: only auto-fixable rules are kept enabled. ---
    // consistent-type-imports puts type imports on their own line; don't flag that as a dupe
    "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
    // Opinionated layout/ordering rules with no auto-fix
    "sort-keys": "off",
    "sort-imports": "off",
    "one-var": "off",
    "func-style": "off",
    "init-declarations": "off",
    "capitalized-comments": "off",
    // Named exports are the codebase convention; these six contradict it and each other
    "import/no-named-export": "off",
    "import/prefer-default-export": "off",
    "import/group-exports": "off",
    "import/exports-last": "off",
    "import/no-namespace": "off",
    "import/no-anonymous-default-export": "off",
    // Backend runs on Node; node builtins are fine
    "import/no-nodejs-modules": "off",
    // Complexity/size caps require real refactoring, not lint fixes
    "max-statements": "off",
    "max-params": "off",
    "id-length": "off",
    "react/jsx-max-depth": "off",
    "unicorn/max-nested-calls": "off",
    // Magic numbers and ternaries are used deliberately throughout
    "no-magic-numbers": "off",
    "no-ternary": "off",
    "no-nested-ternary": "off",
    "unicorn/no-nested-ternary": "off",
    "no-continue": "off",
    // null is load-bearing: Mongo documents and JSON APIs distinguish null from undefined
    "unicorn/no-null": "off",
    // Backend is snake_case (Adonis), frontend camelCase — no single case convention
    "unicorn/filename-case": "off",
    // Prop spreading is idiomatic with Mantine components
    "react/jsx-props-no-spreading": "off",
    "react/jsx-handler-names": "off",
    // .then()/new Promise patterns are deliberate (fire-and-forget, wrapping callbacks)
    "promise/prefer-await-to-then": "off",
    "promise/prefer-await-to-callbacks": "off",
    "promise/avoid-new": "off",
    "promise/no-nesting": "off",
    // Adonis dependency injection uses constructor parameter properties
    "typescript/parameter-properties": "off",
    // No auto-fix, manual rewrites only
    "unicorn/no-await-expression-member": "off",
    "new-cap": "off",
    "func-names": "off",
    "func-name-matching": "off",
    "prefer-named-capture-group": "off",
    "prefer-destructuring": "off",
    "react/function-component-definition": "off",
    "typescript/method-signature-style": "off",
    "unicorn/prefer-ternary": "off",
    "unicorn/prefer-logical-operator-over-ternary": "off",
    // Fix can't tell whether concat() args are arrays or scalars, so it leaves most sites
    "unicorn/prefer-spread": "off",
    // `typeof window === "undefined"` SSR guards are deliberate
    "unicorn/prefer-global-this": "off",
    // Its Boolean() fix defeats TypeScript's inferred type predicates in .filter() narrowing
    "no-implicit-coercion": "off",
    // pdfkit's default export genuinely is PDFDocument
    "import/no-named-as-default": "off",
    // False-positives on MongoDB collection.find(filter, options) as Array#find thisArg
    "unicorn/no-array-method-this-argument": "off",
    // role="status" containers are fine; swapping in <output> changes element semantics/styling
    "jsx-a11y/prefer-tag-over-role": "off",
    // Adonis config files augment modules with empty single-extends interfaces
    "typescript/no-empty-interface": ["error", { allowSingleExtends: true }],
    // oxfmt lowercases hex digits, this rule wants them uppercase — the formatter owns casing
    "unicorn/number-literal-case": "off",
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
  ignorePatterns: [".adonisjs", "**/database/schema.ts", "openapi"],
});
