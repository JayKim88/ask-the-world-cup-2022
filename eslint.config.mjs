// craft-kit coding-style ruleset — Bucket A/B (tool-enforced).
//
// COPY this file to the project root at Phase B, then layer it on top of the
// stack's base config. The rules below encode the deterministic half of the
// coding standard; the judgment half (layering, state ownership, test strategy)
// lives in docs/kit/CODING-STYLE.md and CANNOT be linted.
//
// This template targets a Next.js + TypeScript + React project (the kit's
// primary stack). For other stacks, keep the rule INTENT and map to the
// equivalent linter — see CODING-STYLE.md §1.
//
// devDependencies: the rules below need NOTHING beyond `eslint-config-next`
// (it transitively provides @typescript-eslint + the react plugin). Verified
// against eslint 9.39 + eslint-config-next 16.2.6.
//
// NOT auto-enabled (verified to break without extra setup — see "opt-in" below):
//   - import/order, import/no-cycle  → need eslint-import-resolver-typescript
//     (eslint-config-next's bundled resolver throws "invalid interface").
//   - boolean-name prefix enforcement → needs typed linting (parserOptions.project);
//     left as a judgment rule in CODING-STYLE.md §2.3 instead.

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Style rules that tooling enforces so the agent never has to recall them.
// Each rule is tagged with its CODING-STYLE.md rule id.
const craftKitStyle = {
  rules: {
    // #1 No type escapes — no `any`, no object-literal `as` casts.
    //    (Allows boundary casts like `res.json() as Promise<T>`; flags `{...} as T`.)
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-assertions": [
      "error",
      { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
    ],

    // #2 No debug code.
    "no-console": "error",
    "no-debugger": "error",

    // #9 One-liner arrow functions: no braces.
    "arrow-body-style": ["error", "as-needed"],

    // #15 No silent catch.
    "no-empty": ["error", { allowEmptyCatch: false }],

    // #16 `const` by default.
    "prefer-const": "error",

    // #12 Guard-clause style: cap nesting depth (style/example → CODING-STYLE.md §2.3).
    "max-depth": ["error", 2],

    // #21 No I/T type prefix  +  #22 const-by-scope casing.
    //     (Boolean-prefix enforcement omitted — needs typed linting; see §2.3.)
    "@typescript-eslint/naming-convention": [
      "error",
      { selector: "interface", format: ["PascalCase"], custom: { regex: "^I[A-Z]", match: false } },
      { selector: "typeAlias", format: ["PascalCase"], custom: { regex: "^T[A-Z]", match: false } },
      {
        selector: "variable",
        modifiers: ["const", "global"],
        format: ["UPPER_CASE", "camelCase", "PascalCase"],
      },
    ],

    // #13 Magic numbers (warn — string keys handled by review, see CODING-STYLE.md §2.3).
    "@typescript-eslint/no-magic-numbers": [
      "warn",
      {
        ignore: [-1, 0, 1, 2],
        ignoreEnums: true,
        ignoreReadonlyClassProperties: true,
        ignoreTypeIndexes: true,
        ignoreArrayIndexes: true,
      },
    ],

    // G8 Type-only imports use `import type`.
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports", fixStyle: "separate-type-imports" },
    ],

    // G12 type vs interface for object shapes is NOT enforced — it's cosmetic (no
    //     correctness impact) and forcing `interface` removes the deliberate "closed
    //     shape" choice + re-enables silent declaration merging. Default guideline
    //     (prefer interface, type when purposeful) lives in CODING-STYLE.md §2.2.

    // G14 No `dangerouslySetInnerHTML` escape hatch — build nodes via createElement/JSX.
    "react/no-danger": "error",
  },
};

// ── Opt-in rules ───────────────────────────────────────────────────────────
// Enable these only after `npm i -D eslint-import-resolver-typescript` and
// adding the resolver setting below. Without it they THROW in eslint-config-next 16.
//
// const importHygiene = {
//   settings: { "import/resolver": { typescript: true } },
//   rules: {
//     // #18 Import group ordering + blank line between groups.
//     "import/order": [
//       "error",
//       {
//         groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
//         pathGroups: [{ pattern: "@/**", group: "internal" }],
//         pathGroupsExcludedImportTypes: ["builtin"],
//         "newlines-between": "always",
//         alphabetize: { order: "asc", caseInsensitive: true },
//       },
//     ],
//     // #24 Barrel discipline — block the circular-import risk.
//     "import/no-cycle": "error",
//   },
// };

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  craftKitStyle,
  // ...add importHygiene here once the resolver is installed.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
