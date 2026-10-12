import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // svgr turns `*.svg?react` imports (KYC scenes in src/assets/kyc) into
  // React components so they can inherit currentColor and size props.
  plugins: [
    react(),
    svgr(),
    VitePWA({
      // injectManifest (not generateSW) so the worker's navigation, API and
      // offline behaviour is explicit code in src/sw.js rather than inferred
      // from a config object. See src/sw.js for the three rules that must not
      // regress, and docs/pwa.md.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "og-image.png",
        "maskable-icon-512.png",
      ],
      manifest: {
        id: "/",
        name: "Glasspay",
        short_name: "Glasspay",
        description: "Community finance platform for Nigerian associations, clubs, and schools.",
        theme_color: "#002FA7",
        background_color: "#F7F8FC",
        display: "standalone",
        scope: "/",
        start_url: "/",
        shortcuts: [
          {
            name: "My Communities",
            url: "/member/communities",
            icons: [{ src: "/favicon-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Make Payment",
            url: "/member/manage-payments",
            icons: [{ src: "/favicon-192x192.png", sizes: "192x192" }],
          },
        ],
        icons: [
          { src: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/maskable-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        // The app shell: index.html, the entry JS/CSS, the lazy route chunks
        // each screen needs, icons and illustrations. This is build OUTPUT --
        // no user data of any kind -- and precaching it is what lets an
        // offline navigation render the app instead of hanging on a chunk that
        // has to come from the network.
        //
        // Fonts (woff/woff2) are deliberately NOT precached: they add ~1 MB to
        // a first load and the only offline consequence is the shell falling
        // back to system fonts. For a mobile-first audience on metered data
        // that trade is worth it. No user data is involved either way.
        globPatterns: ["**/*.{js,css,html,ico,png,webp,svg}"],
        // The largest emitted chunk is the receipt generator (jspdf, ~400 kB).
        // The plugin fails the build on a "file too large" warning, so raise
        // the ceiling above it rather than silently dropping an asset.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    // Vitest's default is 5s, which is too tight for the tests that pull
    // modules in with `await import(...)` inside the test body -- there are 47
    // such imports across 17 files, and they bill module loading against the
    // timeout. communityListConsumers.test.jsx does three sequential imports
    // plus async API mocking plus waitFor, and it sat right on the boundary:
    // it failed intermittently even at --maxWorkers=1, and reliably under
    // parallelism. Raising the budget does not weaken the assertion; it stops
    // a legitimately slow test from reading as a regression.
    testTimeout: 15000,
    // e2e/ is Playwright (npm run test:e2e), not Vitest — without this the
    // default *.spec.js glob swallows those files and fails on the
    // @playwright/test import.
    exclude: [...configDefaults.exclude, "e2e/**", "**/node_modules/**"],
    coverage: {
      provider: "v8",
      // Union of both branches: the summaries plus text detail, the local
      // html drill-down, and lcov for badges/future CI coverage reporting.
      reporter: ["text", "text-summary", "html", "lcov", "json-summary"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/__tests__/**", "src/main.jsx", "src/App.jsx", "src/pages/dev/**"],
      // Floors measured against the suite as of the initial coverage gate
      // (overall ~20% lines — a jsdom SPA with page-heavy surface). They are
      // regression gates, not aspirations: raise them when adding tests,
      // never lower them to make CI green.
      thresholds: {
        lines: 19,
        functions: 14,
        statements: 19,
        branches: 16,
        "src/utils/**": {
          lines: 48,
          functions: 43,
          statements: 49,
          branches: 53,
        },
        "src/api/**": {
          lines: 50,
          functions: 27,
          statements: 50,
          branches: 50,
        },
      },
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules[\\/](react|react-dom|react-router-dom)[\\/]/.test(id))
            return "react-vendor";
          if (
            id.includes("node_modules/@tanstack/react-query") ||
            id.includes("node_modules\\@tanstack\\react-query")
          )
            return "query-vendor";
        },
      },
    },
  },
  server: {
    port: 3000,
    // proxy: {
    //   // Forwards /api requests server-side to the real backend. The
    //   // browser itself never sees a cross-origin request (so its CORS
    //   // preflight never fires) — but the backend was found to ALSO run
    //   // its own server-side Origin check independent of standard CORS,
    //   // rejecting anything not matching its allowlist. We rewrite the
    //   // Origin header here to one of the backend's allowed values so
    //   // that check passes too.
    //   "/api": {
    //     target: "https://api.glasspay.app",
    //     changeOrigin: true,
    //     secure: true,
    //     headers: {
    //       Origin: "https://api.glasspay.app",
    //     },
    //   },
    // },
  },
});
