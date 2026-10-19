import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "coverage", "playwright-report", "test-results"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      react,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        // Pendo's analytics snippet (index.html) attaches this to window;
        // it's never imported, so plain browser globals don't cover it.
        pendo: "readonly",
      },
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      // Base no-unused-vars doesn't see `<motion.div>`-style JSX member
      // expressions as a use of `motion` -- without this, every import used
      // only that way (framer-motion/motion throughout this app) false-
      // positives as unused.
      "react/jsx-uses-vars": "error",
      // Accessibility — jsx-a11y recommended minus the five rules that have
      // large pre-existing backlogs (label-has-associated-control 85,
      // click-events-have-key-events 47, no-static-element-interactions 46,
      // no-autofocus 16, no-noninteractive-element-interactions 1). The rest
      // of recommended (alt-text, ARIA validity, roles, etc.) stays error-
      // level so new UI can't regress. Re-enable the five as their debt is
      // paid down — see docs/testing-strategy.md.
      // react-refresh 0.5 tightened only-export-components: a variable export
      // is only a component if it initialises to a function, or to a call of a
      // recognised HOC. illustrations.jsx builds all 14 of its scenes/glyphs
      // through the local sceneFor/glyphFor factories, so declare them here.
      // NOTE: flat config REPLACES inherited rule options rather than merging
      // them, so the two flags that reactRefresh.configs.vite (in extends[])
      // supplies must be restated -- dropping allowConstantExport makes
      // InviteLanding.jsx fail on its PENDING_INVITE_KEY literal export.
      "react-refresh/only-export-components": [
        "error",
        {
          allowConstantExport: true,
          allowCompoundComponents: true,
          extraHOCs: ["sceneFor", "glyphFor"],
        },
      ],
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y/label-has-associated-control": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/no-autofocus": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
    },
  },
  {
    // Node-side tooling config (runs under Node, not the browser).
    files: ["playwright.config.js", "vite.config.js", "eslint.config.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]);
