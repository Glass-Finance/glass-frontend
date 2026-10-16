import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import Topbar from "../components/dashboard/Topbar";
import DashboardTour from "../components/dashboard/DashboardTour";
import {
  DASHBOARD_TOUR_SEEN_KEY,
  COMMUNITIES_HOME_STEPS,
} from "../components/dashboard/dashboardTourSteps";
import AutoPayPrompt from "../components/common/AutoPayPrompt";
import KeyboardShortcutsProvider from "../components/dashboard/KeyboardShortcutsProvider";
import KeyboardShortcutsHelp from "../components/dashboard/KeyboardShortcutsHelp";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  // Community Home (the cross-community overview) gets its own tour content
  // -- the default tour is written in singular-community language ("this is
  // where you manage your community's dues"), which doesn't fit this page.
  const isCommunitiesHome = location.pathname === "/dashboard/home";
  // Sidebar is an off-canvas drawer below the md breakpoint (see
  // Sidebar.jsx) -- this state is lifted here since the hamburger that
  // opens it lives in the sibling Topbar, not Sidebar itself.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  // Scoped one-notch text/spacing downscale for just the dashboard -- see
  // the html.dashboard-compact rule in index.css for why this is a root
  // font-size class instead of `zoom` on this layout's own div. Toggled on
  // <html> (not this component's own root) since font-size has to be set
  // above every rem-based Tailwind utility to cascade into them; removed on
  // unmount so navigating to auth/marketing/member routes isn't affected.
  useEffect(() => {
    document.documentElement.classList.add("dashboard-compact");
    return () => document.documentElement.classList.remove("dashboard-compact");
  }, []);

  // Auto-show the first-launch walkthrough once per browser; the help icon
  // in Topbar lets it be replayed on demand afterward.
  useEffect(() => {
    try {
      // Reads localStorage, an external system -- genuinely needs an
      // effect, not a render-time value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(DASHBOARD_TOUR_SEEN_KEY)) setTourOpen(true);
    } catch {
      // localStorage unavailable (e.g. private browsing) — just skip the tour
    }
  }, []);

  function closeTour() {
    setTourOpen(false);
    try {
      localStorage.setItem(DASHBOARD_TOUR_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  // Auto-Pay prompt handoff for the redirect-based (Paystack-hosted) admin
  // payment path -- AdminPaymentCallback stashes this once verification
  // lands on success (see its own maybeOfferAutoPay), since the admin can
  // land back on any /dashboard/* route depending on where they paid from
  // (AdminDashboard's own "Your Payments", or CommunitiesHome's
  // cross-community overview) -- this layout wraps both, so reading it here
  // once covers every landing page instead of duplicating the same
  // read-on-mount logic in each page. Read once on mount and consume
  // immediately so a refresh/re-visit doesn't reopen it.
  const [autoPayPrompt, setAutoPayPrompt] = useState(() => {
    try {
      const raw = sessionStorage.getItem("glass_autopay_prompt_admin");
      if (!raw) return null;
      sessionStorage.removeItem("glass_autopay_prompt_admin");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  function dismissAutoPayPrompt() {
    if (autoPayPrompt?.paymentLinkId) {
      try {
        localStorage.setItem(`glass_autopay_asked_${autoPayPrompt.paymentLinkId}`, "1");
      } catch {
        /* ignore */
      }
    }
    setAutoPayPrompt(null);
  }

  function enableAutoPay() {
    dismissAutoPayPrompt();
    navigate("/dashboard/settings/finance/auto-pay");
  }

  return (
    // h-dvh, not h-screen -- 100vh on iOS Safari includes the space behind
    // the address bar even while it's on screen, so h-screen renders taller
    // than what's actually visible, cutting off whatever's pinned to the
    // bottom (the sidebar's Member View link, the user info strip). Same
    // fix MemberAppLayout.jsx already uses for the equivalent problem there.
    <KeyboardShortcutsProvider>
      <div className="h-dvh w-screen flex overflow-hidden bg-surface-bg">
        {/* ── Sidebar ── */}
        <Sidebar
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
          onOpenTour={() => setTourOpen(true)}
        />

        {/* ── Main ──
            Background lives on this inner wrapper (the area right of the
            sidebar) rather than the full-width outer container -- centering
            against the full w-screen width put the image's true center inside
            the sidebar's own footprint, which reads as shifted left relative
            to the actual visible content area.

            admin-background.webp turned out to be the actual problem: it's a
            tall 1728x2312 portrait crop with its glow confined to the upper
            third and nothing below it. In a wide/short dashboard viewport,
            bg-cover scales it width-driven, blowing it up far taller than the
            container -- any bottom-anchored position (the previous attempt,
            reasoned from a Figma screenshot read as "bottom-left") shows only
            the image's blank lower two-thirds, cropping the glow out
            entirely. That's why it was invisible. Reusing the same asset +
            technique the onboarding pages already rely on for this exact
            problem: bg-page-default is a landscape image sized for this
            aspect ratio, shown with bg-contain (never crops) + bg-center. */}
        <div className="flex-1 flex flex-col overflow-hidden bg-contain bg-center bg-no-repeat bg-page-default">
          {/* Topbar */}
          <Topbar
            isCommunitiesHome={isCommunitiesHome}
            onMenuClick={() => setMobileNavOpen(true)}
            onOpenTour={() => setTourOpen(true)}
          />

          {/* Page content — background texture lives on the wrapper above so
              every dashboard page gets it uniformly, instead of each page
              applying its own copy on a div sized to its own content (h-full
              there only fills the content's own height, leaving a plain gray
              gap below on shorter pages like Settings). */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>

        {tourOpen && (
          <DashboardTour
            onClose={closeTour}
            onNeedMobileNav={setMobileNavOpen}
            steps={isCommunitiesHome ? COMMUNITIES_HOME_STEPS : undefined}
          />
        )}
        {autoPayPrompt && (
          <AutoPayPrompt
            prompt={autoPayPrompt}
            onDismiss={dismissAutoPayPrompt}
            onEnable={enableAutoPay}
          />
        )}
        <KeyboardShortcutsHelp />
      </div>
    </KeyboardShortcutsProvider>
  );
}
