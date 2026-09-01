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
  categories: {
    correctness: "error",
    suspicious: "error",
    pedantic: "error",
    perf: "error",
    style: "error",
  },
  rules: {
    // Deep-readonly parameters everywhere is not a convention this codebase uses
    "typescript/prefer-readonly-parameter-types": "off",
    // Truthiness checks on strings/numbers/nullables are used deliberately throughout
    "typescript/strict-boolean-expressions": "off",
    // Adding/removing async changes API shape (Promise identity); manual work — revisit
    "require-await": "off",
    "typescript/require-await": "off",
    // Void arrow shorthands (`onClick={() => setX(1)}`) are idiomatic; fix is churny
    "typescript/no-confusing-void-expression": "off",
    "typescript/strict-void-return": "off",
    // Size caps require refactoring, not lint fixes (same call as the style category)
    "max-lines-per-function": "off",
    "max-lines": "off",
    "max-depth": "off",
    "import/max-dependencies": "off",
    // Inline and TODO comments are used deliberately
    "no-inline-comments": "off",
    "no-warning-comments": "off",
    // Adding the /u flag can change matching semantics; not a safe bulk fix
    "require-unicode-regexp": "off",
    // The legacy Mongo/any-typed surface makes the no-unsafe-* family unavoidable
    // during the Mongoose→Lucid migration — revisit once the legacy layer shrinks
    "typescript/no-unsafe-member-access": "off",
    "typescript/no-unsafe-assignment": "off",
    "typescript/no-unsafe-argument": "off",
    "typescript/no-unsafe-return": "off",
    "typescript/no-unsafe-call": "off",
    // ~98 manual fixes (mostly async handlers in void positions) — revisit
    "typescript/no-misused-promises": "off",
    // Swapping if/else branches at 33 sites is manual and stylistic
    "no-negated-condition": "off",
    "unicorn/no-negated-condition": "off",
    // `.map(callbackReference)` is used deliberately; wrapping in arrows is churn
    "unicorn/no-array-callback-reference": "off",
    // Norwegian copy is full of quotes/apostrophes; HTML entities hurt readability
    "react/no-unescaped-entities": "off",
    // Genuinely conflicts with typescript/consistent-return (kept enabled): the explicit
    // `return undefined` it wants removed is exactly what consistent-return demands when
    // other branches return values (useEffect early exits), and the remaining hits are
    // explicit-undefined arguments that the signatures require — not a revisit candidate
    "unicorn/no-useless-undefined": "off",
    // `== null` / `!= null` nullish checks are idiomatic and kept
    eqeqeq: ["error", "always", { null: "ignore" }],
    // Inside `Boolean(a || b)` the `||` is truthiness logic, not defaulting — converting
    // it to `??` would change behavior. Note: `!(a || b)` is NOT covered by this option;
    // make optional members explicit there (`x ?? false` / `Boolean(x)`)
    "typescript/prefer-nullish-coalescing": ["error", { ignoreBooleanCoercion: true }],
    // TanStack Router's `throw redirect()` is idiomatic in loaders/guards — allow the
    // Redirect type it returns; everything else thrown must be an Error
    "typescript/only-throw-error": [
      "error",
      { allow: [{ from: "package", name: "Redirect", package: "@tanstack/router-core" }] },
    ],
    // A default clause counts as handling the remaining union members
    "typescript/switch-exhaustiveness-check": [
      "error",
      { considerDefaultExhaustiveForUnions: true },
    ],
    // --- Perf category ---
    // These only matter for components wrapped in React.memo, which this codebase
    // doesn't use; JSX/objects/functions as props is the core Mantine idiom
    "react-perf/jsx-no-new-function-as-prop": "off",
    "react-perf/jsx-no-new-object-as-prop": "off",
    "react-perf/jsx-no-new-array-as-prop": "off",
    "react-perf/jsx-no-jsx-as-prop": "off",
    // Sequential awaits are deliberate (ordered side-effects, DB writes, rate-limited
    // external APIs); blanket Promise.all parallelization is a behavior change
    "no-await-in-loop": "off",
    // Index keys are the idiomatic choice for the dominant hits: TanStack Form array
    // fields (subfields are addressed by index anyway), static skeleton loaders, and
    // read-only lists whose rows have no unique field
    "react/no-array-index-key": "off",
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
    // All hits are third-party factory idioms (VippsCheckout, JsBarcode, Client) and
    // `new this.mongooseModel()`; the options needed to allow them gut the rule
    "new-cap": "off",
    "prefer-destructuring": "off",
    // `typeof window === "undefined"` SSR guards are deliberate
    "unicorn/prefer-global-this": "off",
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
    // Most hits are benign form/library method references that would need `this: void`
    // annotations or arrow wrappers for no runtime gain
    "@typescript-eslint/unbound-method": "off",
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
