import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useRegisterShortcutGroup } from "../../hooks/useKeyboardShortcuts";
import { ADMIN_NAV_ITEMS, ADMIN_TAB_IDS } from "../../components/dashboard/admin/adminNav";
import SystemConfig from "./settings/admin/SystemConfig";
import OverviewSection from "./platform-admin/OverviewSection";
import CommunitiesSection from "./platform-admin/CommunitiesSection";
import AccountsSection from "./platform-admin/AccountsSection";
import UsersSection from "./platform-admin/UsersSection";
import PaymentLinksSection from "./platform-admin/PaymentLinksSection";
import BalancesSection from "./platform-admin/BalancesSection";
import SettlementsSection from "./platform-admin/SettlementsSection";
import ReconciliationSection from "./platform-admin/ReconciliationSection";
import NotificationsSection from "./platform-admin/NotificationsSection";
import KycSection from "./platform-admin/KycSection";
import TransactionsSection from "./platform-admin/TransactionsSection";
import ObligationsSection from "./platform-admin/ObligationsSection";
import AuditLogsSection from "./platform-admin/AuditLogsSection";

export default function PlatformAdmin() {
  usePageTitle("Admin Panel");

  // The active section lives in the URL (?tab=…) because the shell's nav
  // — AdminSidebar, the ⌘K palette's jump() — lives outside this page, in
  // DashboardLayout. Unknown/absent values fall back to the first row.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = ADMIN_TAB_IDS.includes(tabParam) ? tabParam : "overview";
  // Seeded by the ⌘K palette (?tab=…&q=…). Part of the remount key below so
  // a jump into an already-mounted section still starts with its search.
  const query = searchParams.get("q") ?? "";

  // Digit keys, not "g <letter>" chords -- this page's own tabs are a
  // sub-navigation *within* wherever "g a" already landed you, not another
  // top-level destination, so borrowing the "go to" prefix here would
  // blur that distinction. Numbered tabs is the same convention browser tab
  // switching and Slack channel-jumping already use. Positional against
  // ADMIN_NAV_ITEMS — inserting a row renumbers the keys after it.
  const tabShortcuts = useMemo(
    () =>
      ADMIN_NAV_ITEMS.map(({ id, label }, i) => ({
        keys: String(i + 1),
        description: `Switch to ${label}`,
        handler: () => setSearchParams({ tab: id }),
      })),
    [setSearchParams],
  );
  useRegisterShortcutGroup(tabShortcuts, "Platform Admin");

  return (
    // Keyed by tab+q: sections hold their own search/filter/page state, so
    // remounting on a palette jump (or a back/forward across ?q=) is what
    // makes the URL seed land — and keeps stale state out of the next tab.
    <div key={`${activeTab}:${query}`} className="px-4 py-6 md:px-8 md:py-8 min-h-full">
      {activeTab === "overview" && <OverviewSection />}
      {activeTab === "communities" && <CommunitiesSection />}
      {activeTab === "accounts" && <AccountsSection />}
      {activeTab === "users" && <UsersSection />}
      {activeTab === "payment-links" && <PaymentLinksSection />}
      {activeTab === "balances" && <BalancesSection />}
      {activeTab === "settlements" && <SettlementsSection />}
      {activeTab === "transactions" && <TransactionsSection />}
      {activeTab === "obligations" && <ObligationsSection />}
      {activeTab === "reconciliation" && <ReconciliationSection />}
      {activeTab === "audit-logs" && <AuditLogsSection />}
      {activeTab === "kyc" && <KycSection />}
      {activeTab === "notifications" && <NotificationsSection />}
      {activeTab === "system-config" && <SystemConfig />}
    </div>
  );
}
