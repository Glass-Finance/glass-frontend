import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { InstallPromptProvider } from "./hooks/useInstallPrompt.js";

// Self-hosted fonts (replacing a Google Fonts CSS @import that silently
// never shipped -- @import "tailwindcss" in index.css expands to real CSS
// rules ahead of it at build time, and any @import positioned after another
// rule is dropped entirely per spec. Importing as JS modules here sidesteps
// that whole class of bug: each one becomes its own bundled/hashed CSS
// asset in Vite's module graph, not a rule inside index.css competing for
// position. Also drops the runtime dependency on fonts.googleapis.com.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";

import "./index.css";
import { AuthProvider } from "./store/AuthContext.jsx";
import RealtimeBridge from "./components/common/RealtimeBridge.jsx";
import CrispChat from "./components/common/CrispChat.jsx";
import { notifyError } from "./utils/errorHandler.js";
import { toastSuccess } from "./utils/toast.js";
import { initMonitoring } from "./utils/monitoring.js";
// Registers the service worker via vite-plugin-pwa's virtual module. Importing
// this (rather than relying on an injected <script src="/registerSW.js">) is
// what makes registerType:"autoUpdate" do anything -- see
// src/pwa/registerServiceWorker.js.
import "./pwa/registerServiceWorker.js";

initMonitoring();

// "Continue with Google" needs a real OAuth Client ID from Google Cloud
// Console — see .env.example. Falls back to an empty string rather than
// crashing the whole app if it isn't set yet; the Google button itself
// will just fail to render/authenticate until it is.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

// The browser's own scroll restoration ("auto") fights with each page's
// own scroll-to-top effect on route change — it holds the previous page's
// scroll position for a beat before the effect wins, producing a visible
// flash/jump. Handing scroll restoration entirely to the app removes that
// race.
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

// After a new deploy, old chunk hashes no longer exist on the server.
// Vite fires this event when a dynamic import chunk fails to load —
// a hard reload fetches the new index.html and fresh chunks.
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

// Boot Pendo with an anonymous visitor. Deliberately omitting visitor.id
// (rather than passing an explicit "") -- Pendo's own agent generates and
// persists an anonymous ID via its own cookie/localStorage when no id is
// given; an explicit empty string is a documented Pendo footgun where every
// anonymous visitor site-wide can collapse into one merged visitor record
// instead of each getting their own, corrupting pre-login funnel data.
// pendo.identify() is called later once the user signs in (see AuthContext).
pendo.initialize();

/**
 * QueryClient — React Query
 * ─────────────────────────
 * Handles all API calls: caching, background refetching, loading/error states.
 * Instead of writing useEffect + fetch everywhere, you call useQuery() / useMutation()
 * and React Query manages the lifecycle. The staleTime below means data won't
 * re-fetch for 60s after it was last fetched — good for dashboard stats.
 *
 * mutationCache.onError is the single place every mutation's error lands —
 * registration, payments, member management, settings updates, everywhere —
 * without each of the ~77 useMutation call sites across the app needing its
 * own onError. A hook can still set its own onError (e.g. to roll back an
 * optimistic update) without losing this: that local handler runs first,
 * and the toast still fires here afterward, since this is the cache-level
 * callback rather than a per-mutation override.
 *
 * onSuccess mirrors it for the success side, opt-in rather than opt-out
 * (most mutations close a modal or just re-render and don't need a toast
 * on top of that) via:
 *   useMutation({ ..., meta: { successMessage: "Member added" } })
 */
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // A mutation can opt out of the global toast (e.g. it already shows
      // its own inline error and a toast would be redundant) via:
      //   useMutation({ ..., meta: { silentError: true } })
      if (mutation.options.meta?.silentError) return;
      notifyError(error, { context: mutation.options.mutationKey?.join(".") });
    },
    onSuccess: (data, variables, _context, mutation) => {
      // successMessage can be a string, or a function of (variables, data)
      // for messages that depend on what was actually submitted — e.g.
      // "Your last name was updated" instead of a generic "Profile updated".
      const raw = mutation.options.meta?.successMessage;
      const message = typeof raw === "function" ? raw(variables, data) : raw;
      if (message) toastSuccess(message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 60s before data is considered stale
      retry: 1, // retry failed requests once
      refetchOnWindowFocus: false, // don't refetch just because user switches tabs
    },
  },
});

/**
 * Toaster (sonner)
 * ─────────────────
 * Global toast notifications. Any component can call toast("message") or
 * toast.success() / toast.error() without prop-drilling. Shows payment
 * confirmations, error alerts, reminder sent notices, etc.
 * Install: npm install sonner
 */

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/*
      QueryClientProvider — wraps the whole app so any component can use
      useQuery / useMutation to fetch from your backend without passing
      fetch functions as props.
    */}
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>
          {/*
            CrispChat must mount BEFORE <App/>: React flushes effects in tree
            order, and CrispChat's mount effect is what runs
            Crisp.configure() on the SDK. CrispRouteBridge (inside App) calls
            Crisp.chat.show() from its own effect on the first route — if the
            chat hasn't configured yet, the real SDK throws "websiteId must
            be set before loading Crisp" out of that effect, the ErrorBoundary
            below catches it, and every fresh page load renders "Something
            went wrong" instead of the app (this hit /sign-in in production).
          */}
          <CrispChat />
          <ErrorBoundary>
            <InstallPromptProvider>
              <App />
            </InstallPromptProvider>
          </ErrorBoundary>
          <RealtimeBridge />
          <SpeedInsights />
          <Analytics />

          <Toaster
            position="bottom-right"
            closeButton
            icons={{
              // Status icon colours come from the docs/design-system.md status
              // tokens (§1.6 bans the Tailwind emerald/red/amber these
              // replaced: none of them appear in the Figma file).
              success: <CheckCircle2 size={18} className="text-success" />,
              error: <XCircle size={18} className="text-danger" />,
              warning: <AlertTriangle size={18} className="text-warning" />,
              info: <Info size={18} className="text-brand" />,
              loading: <Loader2 size={18} className="text-ink-faint animate-spin" />,
            }}
            toastOptions={{
              style: {
                fontSize: "13px",
              },
              classNames: {
                toast: "rounded-2xl! border! border-hairline-soft! shadow-lg! bg-white! text-ink!",
                title: "font-medium! text-ink!",
                description: "text-xs! text-ink-muted!",
                closeButton:
                  "bg-white! border! border-hairline-neutral! text-ink-faint! hover:text-ink-muted!",
                // Buttons are 4px radius at every state (§2.1) and label
                // weight 500 (§7.1); the old rounded-full + semibold was
                // off-system.
                actionButton: "bg-brand! text-white! rounded-g-1! text-xs! font-medium!",
                cancelButton:
                  "bg-transparent! border! border-black/10! text-ink! rounded-g-1! text-xs! font-medium!",
                error: "border-l-4! border-l-danger!",
                success: "border-l-4! border-l-success!",
                warning: "border-l-4! border-l-warning!",
                info: "border-l-4! border-l-brand!",
                loading: "border-l-4! border-l-hairline-neutral!",
              },
            }}
          />
        </AuthProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
