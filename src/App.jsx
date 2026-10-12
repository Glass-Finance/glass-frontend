import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import LoadingScreen from "./components/LoadingScreen";
import CrispRouteBridge from "./components/common/CrispRouteBridge";
import InstallPrompt from "./components/InstallPrompt";
import IosInstallInstructions from "./components/IosInstallInstructions";
import PwaUpdateReload from "./pwa/PwaUpdateReload";
import { isAppHost, MARKETING_ORIGIN } from "./utils/deviceRedirect";

// ── Guards (eager — lightweight, needed for route resolution) ─────────────────
import ProtectedRoute from "./routes/ProtectedRoute";
import MemberProtectedRoute from "./routes/MemberProtectedRoute";
import MemberDeviceGuard from "./routes/MemberDeviceGuard";
import PlatformAdminRoute from "./routes/PlatformAdminRoute";
import CommunityAdminGuard from "./routes/CommunityAdminGuard";

// ── Landing pages ─────────────────────────────────────────────────────────────
const OrganizationsHome = lazy(() => import("./pages/OrganizationsHome"));
const MembersHome = lazy(() => import("./pages/MembersHome"));
const InviteLanding = lazy(() => import("./pages/InviteLanding"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/legal/CookiePolicy"));
const AcceptableUsePolicy = lazy(() => import("./pages/legal/AcceptableUsePolicy"));
const RefundPolicy = lazy(() => import("./pages/legal/RefundPolicy"));

// ── Dev-only visual QA (never bundled in production) ─────────────────────────
const SuccessPreview = lazy(() => import("./pages/dev/SuccessPreview"));

// ── Auth pages ────────────────────────────────────────────────────────────────
const SignUp = lazy(() => import("./pages/auth/SignUp/SignUp"));
const SignIn = lazy(() => import("./pages/auth/SignIn"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const CheckEmail = lazy(() => import("./pages/auth/member/CheckEmail"));
const Join = lazy(() => import("./pages/auth/member/Join"));
const MobileRequired = lazy(() => import("./pages/auth/member/MobileRequired"));

// ── Onboarding pages ──────────────────────────────────────────────────────────
const ChoosePath = lazy(() => import("./pages/onboarding/ChoosePath"));
const OnboardingVerifyIdentity = lazy(() => import("./pages/onboarding/VerifyIdentity"));
const PayingMember = lazy(() => import("./pages/onboarding/PayingMember"));
const OrganizationProfile = lazy(() => import("./pages/onboarding/OrganizationProfile"));
const PaymentProfile = lazy(() => import("./pages/onboarding/PaymentProfile"));
const AddMembers = lazy(() => import("./pages/onboarding/AddMembers"));

// ── Admin dashboard layout + pages ───────────────────────────────────────────
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const CommunitiesHome = lazy(() => import("./pages/dashboard/CommunitiesHome"));
const DashboardVerifyIdentity = lazy(() => import("./pages/dashboard/VerifyIdentity"));
const DashboardVerifyIdentityHistory = lazy(
  () => import("./pages/dashboard/VerifyIdentityHistory"),
);
const AdminDashboard = lazy(() => import("./pages/dashboard/AdminDashboard"));
const JoinRequests = lazy(() => import("./pages/dashboard/JoinRequests"));
const PayingAdminDashboard = lazy(() =>
  import("./pages/dashboard/AdminDashboard").then((m) => ({
    default: m.PayingAdminDashboard,
  })),
);
const Payments = lazy(() => import("./pages/dashboard/Payments"));
const Members = lazy(() => import("./pages/dashboard/Members"));
const Groups = lazy(() => import("./pages/dashboard/Groups"));
const MemberDetail = lazy(() => import("./pages/dashboard/MemberDetail"));
const AdminTransactionDetail = lazy(() => import("./pages/dashboard/TransactionDetail"));
const AdminNotifications = lazy(() => import("./pages/dashboard/Notifications"));
const PaymentCallback = lazy(() => import("./pages/dashboard/PaymentCallback"));

// ── Settings ──────────────────────────────────────────────────────────────────
const Settings = lazy(() => import("./pages/dashboard/settings/Settings"));
const Profile = lazy(() => import("./pages/dashboard/settings/account/Profile"));
const Role = lazy(() => import("./pages/dashboard/settings/account/Role"));
const NotificationSettings = lazy(() => import("./pages/dashboard/settings/account/Notifications"));
const Security = lazy(() => import("./pages/dashboard/settings/account/Security"));
const PaymentMethod = lazy(() => import("./pages/dashboard/settings/finance/PaymentMethod"));
const AutoPay = lazy(() => import("./pages/dashboard/settings/finance/AutoPay"));
const PaystackAccount = lazy(() => import("./pages/dashboard/settings/finance/PaystackAccount"));
const CommunityProfile = lazy(
  () => import("./pages/dashboard/settings/community/CommunityProfile"),
);
const MemberAccess = lazy(() => import("./pages/dashboard/settings/community/MemberAccess"));
const SystemConfig = lazy(() => import("./pages/dashboard/settings/admin/SystemConfig"));
const PlatformAdmin = lazy(() => import("./pages/dashboard/PlatformAdmin"));

// ── Member app layout + pages ─────────────────────────────────────────────────
const MemberAppLayout = lazy(() => import("./layouts/MemberAppLayout"));
const MemberHome = lazy(() => import("./pages/memberApp/Home"));
const DiscoverCommunities = lazy(() => import("./pages/memberApp/DiscoverCommunities"));
const MemberTransactions = lazy(() => import("./pages/memberApp/Transactions"));
const MemberTransactionDetail = lazy(() => import("./pages/memberApp/TransactionDetail"));
const MemberUpcoming = lazy(() => import("./pages/memberApp/UpcomingPayments"));
const MemberNotifications = lazy(() => import("./pages/memberApp/Notifications"));
const ManagePayments = lazy(() => import("./pages/memberApp/ManagePayments"));
const PaymentSummary = lazy(() => import("./pages/memberApp/PaymentSummary"));
const PaymentSuccess = lazy(() => import("./pages/memberApp/PaymentSuccess"));
const Invites = lazy(() => import("./pages/memberApp/Invites"));
const MemberSettings = lazy(() => import("./pages/memberApp/settings/Settings"));
const MemberProfile = lazy(() => import("./pages/memberApp/settings/account/Profile"));
const MemberUpdateEmail = lazy(() => import("./pages/memberApp/settings/account/UpdateEmail"));
const MemberVerifyPhone = lazy(() => import("./pages/memberApp/settings/account/VerifyPhone"));
const MemberVerifyIdentity = lazy(
  () => import("./pages/memberApp/settings/account/VerifyIdentity"),
);
const MemberVerifyIdentityHistory = lazy(
  () => import("./pages/memberApp/settings/account/VerifyIdentityHistory"),
);
const MyCommunities = lazy(() => import("./pages/memberApp/settings/communities/MyCommunities"));
const MemberSecurity = lazy(() => import("./pages/memberApp/settings/account/Security"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MemberPassword = lazy(() => import("./pages/memberApp/settings/account/Password"));
const MemberTwoFactorAuth = lazy(() => import("./pages/memberApp/settings/account/TwoFactorAuth"));
const MemberAutoPay = lazy(() => import("./pages/memberApp/settings/payments/AutoPay"));
const MemberSavedCards = lazy(() => import("./pages/memberApp/settings/payments/SavedCards"));
const MemberNotificationSettings = lazy(
  () => import("./pages/memberApp/settings/account/Notifications"),
);

// app.glasspay.app is the application only — it doesn't serve its own
// landing pages to real visitors. Landing/legal paths hop to the marketing
// site (glass-waitlist-v1, MARKETING_ORIGIN) with their query string intact.
// No-op anywhere that isn't the real production app host (local dev,
// preview builds), so these pages stay directly viewable here for testing
// and for porting into glass-waitlist-v1 — see that repo's README.
const LANDING_PAGE_PATHS = new Set([
  "/",
  "/members",
  "/privacy",
  "/terms",
  "/cookies",
  "/acceptable-use",
  "/refund-policy",
]);

function LandingPageRedirect() {
  const location = useLocation();
  useEffect(() => {
    if (!isAppHost()) return;
    if (!LANDING_PAGE_PATHS.has(location.pathname)) return;
    window.location.replace(`${MARKETING_ORIGIN}${location.pathname}${location.search}`);
  }, [location]);
  return null;
}

function App() {
  return (
    <Router>
      <LandingPageRedirect />
      {/* Router-aware support chat: hides the widget on sensitive routes
        (KYC/payment/bank-data pages) and pushes page context for agents. */}
      <CrispRouteBridge />
      <Suspense fallback={<LoadingScreen />}>
        <InstallPrompt />
        <IosInstallInstructions />
        {/* Applies a service-worker reload that was deferred while the user
            was mid-payment. Must be inside the Router to read the route. */}
        <PwaUpdateReload />
        <Routes>
          {/* ── Public landing ── */}
          <Route path="/" element={<OrganizationsHome />} />
          <Route path="/members" element={<MembersHome />} />

          {/* ── Invite deep-link — not device-gated so email links work on any
            device. Backend's "Review Invite" email button links to
            /invites?inviteId=... (plural) — the singular /invite alias is
            kept in case anything else already points at it. ── */}
          <Route path="/invites" element={<InviteLanding />} />
          <Route path="/invite" element={<InviteLanding />} />

          {/* ── Legal — not device/domain-gated, so links from emails,
            receipts, or the app subdomain all resolve regardless of host. */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/acceptable-use" element={<AcceptableUsePolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />

          {/* ── Dev-only: SuccessBadge animation preview (DEV builds only;
            null keeps react-router from seeing a non-Route child). ── */}
          {import.meta.env.DEV ? (
            <Route path="/dev/success-badge" element={<SuccessPreview />} />
          ) : null}

          {/* ── Auth ──
            /sign-up is the COMMUNITY OWNER entry point (desktop-first,
            never device-gated). /member/join is the MEMBER registration
            entry point — joining is mobile-only, so it's hard-gated here.
            SignIn/ForgotPassword/ResetPassword are each reachable from two
            routes (no "/member" prefix vs "/member/...") for the admin- and
            member-facing entry points that link to them respectively (the
            admin guard/Sidebar logout vs Join's link/the member
            guard/memberApp logout), but every route pair renders the *same*
            component — neither the page nor the login call itself knows in
            advance whether this is a community owner or a mobile-only
            member, only the resolved destination does (see
            resolveDestination in pages/auth/SignIn.jsx), and AuthLayout
            already adapts its chrome between desktop and mobile via CSS. ── */}
          <Route path="/sign-up" element={<SignUp />} />
          <Route element={<MemberDeviceGuard />}>
            <Route path="/member/join" element={<Join />} />
          </Route>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/member/app-sign-in" element={<SignIn />} />
          <Route path="/member/forgot-password" element={<ForgotPassword />} />
          <Route path="/member/reset-password" element={<ResetPassword />} />
          <Route path="/member/mobile-required" element={<MobileRequired />} />
          <Route path="/check-email" element={<CheckEmail />} />

          {/* ── Onboarding — responsive at every step, so no device gate. ── */}
          <Route path="/onboarding/choose-path" element={<ChoosePath />} />
          <Route path="/onboarding/verify-identity" element={<OnboardingVerifyIdentity />} />
          <Route path="/onboarding/paying-member" element={<PayingMember />} />
          <Route path="/onboarding/organization-profile" element={<OrganizationProfile />} />
          <Route path="/onboarding/payment-profile" element={<PaymentProfile />} />
          <Route path="/onboarding/members" element={<AddMembers />} />

          {/* ── Admin dashboard ── */}
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<CommunitiesHome />} />
              <Route path="notifications" element={<AdminNotifications />} />

              {/* Personal KYC — the desktop counterpart to the member app's
                  mobile-only verify pages. Deep-linkable shell (direct URLs,
                  getting-started checklist, History); gates and badges open
                  the wizard modal inline instead of routing here. */}
              <Route path="verify-identity" element={<DashboardVerifyIdentity />} />
              <Route path="verify-identity/history" element={<DashboardVerifyIdentityHistory />} />

              {/* These all act on whichever community ?community= resolves
                  to (see CommunityAdminGuard) — requiredRole="admin" above
                  only proves admin of *some* community, not this one. */}
              <Route element={<CommunityAdminGuard />}>
                <Route path="admin" element={<AdminDashboard />} />
                <Route path="admin/paying" element={<PayingAdminDashboard />} />
                <Route path="payments" element={<Payments />} />
                <Route path="members" element={<Members />} />
                <Route path="members/:memberId" element={<MemberDetail />} />
                <Route path="groups" element={<Groups />} />
                <Route path="transactions/:transactionId" element={<AdminTransactionDetail />} />
                <Route path="join-requests" element={<JoinRequests />} />
              </Route>

              <Route element={<PlatformAdminRoute />}>
                <Route path="system-config" element={<SystemConfig />} />
                <Route path="admin-panel" element={<PlatformAdmin />} />
              </Route>

              <Route path="settings" element={<Settings />}>
                <Route index element={<Navigate to="account" replace />} />

                {/* Account — bare path renders the menu list inside Settings.jsx */}
                <Route path="account" element={null} />
                <Route path="account/profile" element={<Profile />} />
                <Route path="account/role" element={<Role />} />
                <Route path="account/notifications" element={<NotificationSettings />} />
                <Route path="account/security" element={<Security />} />

                {/* Finance — bare path renders the menu list inside Settings.jsx */}
                <Route path="finance" element={null} />
                <Route path="finance/payment-methods" element={<PaymentMethod />} />
                <Route path="finance/auto-pay" element={<AutoPay />} />

                {/* Community — bare path renders the menu list inside Settings.jsx */}
                <Route path="community" element={null} />

                {/* These act on the active community's payout account and
                    membership — same cross-community risk CommunityAdminGuard
                    exists for above. */}
                <Route element={<CommunityAdminGuard />}>
                  <Route path="finance/paystack" element={<PaystackAccount />} />
                  <Route path="community/profile" element={<CommunityProfile />} />
                  <Route path="community/member-access" element={<MemberAccess />} />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* ── Member app ──
            Mobile-only by design (never device-gated): direct URL access,
            old bookmarks, or links shared into a desktop chat all get the
            QR handoff instead of a half-responsive layout — including
            identity verification. Desktop users verify via the
            dashboard-styled page at /dashboard/verify-identity instead. */}
          <Route element={<MemberDeviceGuard />}>
            <Route element={<MemberProtectedRoute />}>
              <Route path="/member" element={<MemberAppLayout />}>
                <Route index element={<Navigate to="home" replace />} />
                <Route path="communities/search" element={<DiscoverCommunities />} />
                <Route path="home" element={<MemberHome />} />
                <Route path="transactions" element={<MemberTransactions />} />
                <Route path="transactions/:transactionId" element={<MemberTransactionDetail />} />
                <Route path="upcoming" element={<MemberUpcoming />} />
                <Route path="notifications" element={<MemberNotifications />} />
                <Route path="manage-payments" element={<ManagePayments />} />
                <Route path="pay/:paymentId" element={<PaymentSummary />} />
                <Route path="pay/:paymentId/success" element={<PaymentSuccess />} />
                <Route path="invites" element={<Invites />} />

                <Route path="settings" element={<MemberSettings />} />
                <Route path="profile" element={<MemberProfile />} />
                <Route path="update-email" element={<MemberUpdateEmail />} />
                <Route path="verify-phone" element={<MemberVerifyPhone />} />
                <Route path="verify-identity" element={<MemberVerifyIdentity />} />
                <Route path="verify-identity/history" element={<MemberVerifyIdentityHistory />} />
                <Route path="communities" element={<MyCommunities />} />
                <Route path="security" element={<MemberSecurity />} />
                <Route path="security/password" element={<MemberPassword />} />
                <Route path="security/authentication" element={<MemberTwoFactorAuth />} />
                <Route path="auto-pay" element={<MemberAutoPay />} />
                <Route path="saved-cards" element={<MemberSavedCards />} />
                <Route path="notification-settings" element={<MemberNotificationSettings />} />
              </Route>
            </Route>
          </Route>

          {/* ── Payment callback — Paystack redirects here after checkout.
            Deliberately NOT behind ProtectedRoute: the session can expire
            while the payer is on Paystack's page, and a guard redirect here
            would bounce them to sign-in and lose the payment context. The
            page handles the expired-session case itself and preserves the
            pending reference so the payment is confirmed after re-login. ── */}
          <Route path="/payment/callback" element={<PaymentCallback />} />

          {/* ── Catch-all ── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
