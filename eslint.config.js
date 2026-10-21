import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import babelParser from "@babel/eslint-parser";
import babelPresetTypescript from "@babel/preset-typescript";
import { defineConfig, globalIgnores } from "eslint/config";

// ── Debt list: files still using a raw <button> ─────────────────────────────
//
// The rule in the `ui/Button` block below is an ERROR everywhere else, so
// this list is a ratchet: a NEW file that reaches for a raw <button> fails
// lint, and a file leaves this list when it is migrated to ui/Button.
//
// AGENTS.md already asks for a reason for a raw <button>. A few of these have
// one — TableChrome.jsx has no icon-only pager-number variant, and
// MobileBackButton.jsx is a bare chevron with no button chrome at all. The
// rest are simply not migrated yet.
//
// Keeping the debt in ONE list, rather than ~130 inline disables spread over
// the tree, means the remaining work is visible in one place and shrinks over
// time instead of being invisible until the rule is switched on.
const RAW_BUTTON_DEBT = [
  "src/components/auth/ModeTabs.jsx",
  "src/components/common/BankSelect.jsx",
  "src/components/common/EmailChangeModal.jsx",
  "src/components/common/PhoneChangeModal.jsx",
  "src/components/common/ReceiptModal.jsx",
  "src/components/common/Toggle.jsx",
  "src/components/dashboard/NotificationsPanel.jsx",
  "src/components/dashboard/Sidebar.jsx",
  "src/components/dashboard/SidebarPrimitives.jsx",
  "src/components/dashboard/TableChrome.jsx",
  "src/components/dashboard/Topbar.jsx",
  "src/components/ErrorBoundary.jsx",
  "src/components/InstallPrompt.jsx",
  "src/components/IosInstallInstructions.jsx",
  "src/components/kyc/steps/IdTypeStep.jsx",
  "src/components/kyc/steps/StatusStep.jsx",
  "src/components/kyc/useKycFlow.jsx",
  "src/components/memberApp/InvitePopup.jsx",
  "src/components/memberApp/ProfileAvatar.jsx",
  "src/components/memberApp/SideDrawer.jsx",
  "src/components/Navbar.jsx",
  "src/components/organizations/dashboard-overlay/DashboardOverlay.jsx",
  "src/components/organizations/ProblemSection.jsx",
  "src/components/ui/Button.jsx",
  "src/components/ui/LandingCta.jsx",
  "src/components/ui/MobileBackButton.jsx",
  "src/components/UseCases.jsx",
  "src/components/WhyGlass.jsx",
  "src/pages/auth/ForgotPassword.jsx",
  "src/pages/auth/member/Join/StepOTP.jsx",
  "src/pages/dashboard/AdminDashboard.jsx",
  "src/pages/dashboard/admin-dashboard/AddMemberModal.jsx",
  "src/pages/dashboard/admin-dashboard/sections/MemberPaymentsSection.jsx",
  "src/pages/dashboard/admin-dashboard/sections/WelcomeEmptyState.jsx",
  "src/pages/dashboard/admin-dashboard/sections/YourPaymentsSection.jsx",
  "src/pages/dashboard/CommunitiesHome.jsx",
  "src/pages/dashboard/MemberDetail.jsx",
  "src/pages/dashboard/Members.jsx",
  "src/pages/dashboard/Notifications.jsx",
  "src/pages/dashboard/NotificationsSections.jsx",
  "src/pages/dashboard/Payments.jsx",
  "src/pages/dashboard/payments/PlanFormSteps.jsx",
  "src/pages/dashboard/payments/PlanOverflowMenu.jsx",
  "src/pages/dashboard/PlatformAdmin.jsx",
  "src/pages/dashboard/platform-admin/AccountsSection.jsx",
  "src/pages/dashboard/platform-admin/NotificationsSection.jsx",
  "src/pages/dashboard/settings/account/Notifications.jsx",
  "src/pages/dashboard/settings/account/Role.jsx",
  "src/pages/dashboard/settings/admin/SystemConfig.jsx",
  "src/pages/dashboard/settings/community/MemberAccess.jsx",
  "src/pages/dashboard/settings/Settings.jsx",
  "src/pages/memberApp/Home.jsx",
  "src/pages/memberApp/HomeSections.jsx",
  "src/pages/memberApp/ManagePayments.jsx",
  "src/pages/memberApp/Notifications.jsx",
  "src/pages/memberApp/settings/account/Notifications.jsx",
  "src/pages/memberApp/settings/account/Security.jsx",
  "src/pages/memberApp/settings/communities/MyCommunities.jsx",
  "src/pages/memberApp/settings/payments/SavedCards.jsx",
  "src/pages/memberApp/settings/Settings.jsx",
  "src/pages/memberApp/Transactions.jsx",
  "src/pages/memberApp/UpcomingPayments.jsx",
  "src/pages/onboarding/AddMembers.jsx",
  "src/pages/onboarding/ChoosePath.jsx",
  "src/pages/onboarding/PayingMember.jsx",
];

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
      // Only underscore-prefixed names are exempt. The previous pattern was
      // "^[A-Z_]", which ignored EVERY uppercase identifier — and React
      // components are always uppercase, so an unused component import was
      // never reported. The rule was originally widened for `motion`, which
      // is only "used" as <motion.div>; react/jsx-uses-vars below already
      // covers that case properly.
      "no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      // Base no-unused-vars doesn't see `<motion.div>`-style JSX member
      // expressions as a use of `motion` -- without this, every import used
      // only that way (framer-motion/motion throughout this app) false-
      // positives as unused.
      "react/jsx-uses-vars": "error",
      // Accessibility — jsx-a11y recommended minus the five rules that have
      // large pre-existing backlogs (label-has-associated-control 44,
      // click-events-have-key-events 51, no-static-element-interactions 51,
      // no-autofocus 17, no-noninteractive-element-interactions 11 — 174
      // findings across 71 files, measured 2026-10-21). The rest of
      // recommended (alt-text, ARIA validity, roles, etc.) stays error-level
      // so new UI can't regress. Re-enable the five as their debt is paid
      // down — see docs/testing-strategy.md, which records how to re-measure
      // the counts so they cannot drift again.
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
    // The design-system button rule, enforced everywhere except the files
    // still carrying the debt (RAW_BUTTON_DEBT above).
    //
    // `ui/Button` owns the button roles, sizes and focus treatment, and the
    // design system is the source of truth for all of it. A raw <button>
    // opts out of every one of those rules, so the convention needs to be a
    // gate rather than a sentence in AGENTS.md.
    files: ["src/**/*.{js,jsx}"],
    ignores: RAW_BUTTON_DEBT,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXElement[name.name='button']",
          message:
            "Use ui/Button (src/components/ui/Button.jsx) instead of a raw <button>. If a raw button is genuinely required, add the file to RAW_BUTTON_DEBT in eslint.config.js with a reason.",
        },
      ],
    },
  },
  {
    // Components never call the API directly — server state reaches them
    // through the React Query hooks in src/hooks/ (see docs/data-fetching.md).
    //
    // Pages are deliberately NOT covered: a page owns a mutation ("create
    // this community", "delete that obligation") and calling src/api/ for one
    // is the intended shape. The rule is about reads and about where server
    // state is cached, and both belong in a hook.
    files: ["src/components/**/*.{js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/api/*", "**/api/**"],
              message:
                "Components must not call src/api/ directly. Expose the server state through a React Query hook in src/hooks/ — see docs/data-fetching.md.",
            },
          ],
        },
      ],
    },
  },
  {
    // The one TypeScript file in the codebase (src/utils/format.ts) sat
    // outside every ESLint block, so it was never linted at all — not by
    // js.configs.recommended, not by jsx-a11y, not by the React Hooks rules.
    //
    // It is parsed with Babel's TypeScript preset rather than
    // typescript-eslint, because typescript-eslint refuses to load against
    // TypeScript 7 — which is what this repo runs (its supported range
    // stops below TS 7; upstream tracking is typescript-eslint#10940). The
    // Babel preset strips the type syntax and hands ESLint a plain AST, so
    // the ordinary rules apply and nothing depends on the compiler API.
    // The file stays TypeScript: it is a deliberate island, and the branded
    // types in it are the point.
    files: ["**/*.ts"],
    languageOptions: {
      parser: babelParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [[babelPresetTypescript, { allowDeclareFields: true }]],
        },
      },
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
