import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Crisp } from "crisp-sdk-web";

// Router-aware half of the support chat (the chat itself lives outside the
// router in main.jsx, so visibility/page context need this in-router bridge).
//
// Crisp's per-page settings only apply on full page loads — in an SPA we
// have to re-apply visibility on every route change.

// Pages where the widget must NOT be visible: users enter bank details,
// card data, or identity documents here, and a visible chat invites pasting
// them into a third-party log. (Support will never ask for these anyway —
// that's stated in the dashboard welcome message.)
const SENSITIVE_PREFIXES = [
  "/onboarding/payment-profile", // bank/account details
  "/dashboard/verify-identity", // KYC document upload (+ /history)
  "/member/verify-identity",
  "/member/pay", // payment flow (+ /:paymentId, /success)
  "/payment/callback", // Paystack return with payment context
  "/dashboard/finance/payment-methods",
  "/member/saved-cards",
];

const isSensitive = (path) =>
  SENSITIVE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

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
      if (isSensitive(pathname) || mobileDrawerOpen) Crisp.chat.hide();
      else Crisp.chat.show();
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
