import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Crisp } from "crisp-sdk-web";

// Router-aware half of the support chat (the chat itself lives outside the
// router in main.jsx, so visibility/page context need this in-router bridge).
//
// Crisp's per-page settings only apply on full page loads — in an SPA we
// have to re-apply visibility on every route change.
//
// Allow-list, not deny-list: the floating launcher only appears on the
// public site (landing, member landing, invites), the legal pages and
// Settings. Everywhere else in the signed-in app it stays hidden — a
// permanently-visible third-party widget was too noisy for the product.
// Sensitive pages below still win as a deny override for the one allowed
// area that contains them (Settings → payment methods).

// Public site + legal + Settings — the only areas where the launcher shows.
const ALLOWED_PREFIXES = [
  "/members", // member landing page (distinct from /member app routes)
  "/invite",
  "/invites",
  "/privacy",
  "/terms",
  "/cookies",
  "/acceptable-use",
  "/refund-policy",
  "/dashboard/settings",
  "/member/settings",
];

// Pages where the widget must NOT be visible even inside an allowed area:
// users enter bank details, card data, or identity documents here, and a
// visible chat invites pasting them into a third-party log. (Support will
// never ask for these anyway — that's stated in the dashboard welcome
// message.)
const SENSITIVE_PREFIXES = [
  "/onboarding/payment-profile", // bank/account details
  "/dashboard/verify-identity", // KYC document upload (+ /history)
  "/member/verify-identity",
  "/member/pay", // payment flow (+ /:paymentId, /success)
  "/payment/callback", // Paystack return with payment context
  "/dashboard/settings/finance/payment-methods", // card entry (under Settings)
  "/member/saved-cards",
];

const matchesPrefix = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`);

const isSensitive = (path) => SENSITIVE_PREFIXES.some((p) => matchesPrefix(path, p));

// "/" is exact-match only — every nested route lives under its own prefix.
const isAllowed = (path) => path === "/" || ALLOWED_PREFIXES.some((p) => matchesPrefix(path, p));

export default function CrispRouteBridge() {
  const { pathname } = useLocation();
  const websiteId = import.meta.env.VITE_CRISP_WEBSITE_ID;
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const handleDrawerChange = (event) => {
      setMobileDrawerOpen(event.detail === true);
    };
    window.addEventListener("glass:dashboard-mobile-drawer", handleDrawerChange);
    return () => window.removeEventListener("glass:dashboard-mobile-drawer", handleDrawerChange);
  }, []);

  useEffect(() => {
    if (!websiteId) return;

    // Crisp's SDK throws if it's used before CrispChat's mount effect has
    // run Crisp.configure() (this effect can flush first on a fresh page
    // load — hence the mount order in main.jsx). A chat-widget failure must
    // never reach the top-level ErrorBoundary and replace the whole app with
    // an error page: degrade to "widget not updated" instead.
    try {
      if (mobileDrawerOpen || isSensitive(pathname) || !isAllowed(pathname)) {
        Crisp.chat.hide();
      } else {
        Crisp.chat.show();
      }
    } catch (error) {
      console.error("[crisp] chat visibility update failed", error);
    }

    // Agent context: which page the visitor is on. Debounced so rapid
    // navigation doesn't fire a session-data write per keystroke of travel.
    const t = setTimeout(() => {
      try {
        Crisp.session.setData({ page: pathname });
      } catch (error) {
        console.error("[crisp] session data update failed", error);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [pathname, websiteId, mobileDrawerOpen]);

  return null;
}
