// Single source of truth for the platform-admin shell's navigation
// (design: Overview@1x). Consumed by AdminSidebar (the rail) and
// PlatformAdmin.jsx (section router + digit shortcuts) so labels, order
// and the three renames off the old tab strip (Accounts → Payout accounts,
// Notifications → Notification jobs, System Config → System config) can't
// drift between the two. `count: true` marks the six rows the design shows
// a total on — those are the ones useAdminNavCounts fetches.
//
// `id` doubles as the `?tab=` URL param PlatformAdmin reads, so this file
// is also the routing contract between the shell (which lives outside the
// page, in DashboardLayout) and the page itself.

import {
  LayoutGrid,
  Building2,
  Users,
  ShieldCheck,
  CreditCard,
  Link2,
  ArrowLeftRight,
  FileClock,
  Landmark,
  BarChart2,
  Scale,
  FileText,
  Bell,
  SlidersHorizontal,
} from "lucide-react";

// Landing page — sits above the groups with no header (design: Overview@1x).
export const ADMIN_NAV_TOP = { id: "overview", label: "Overview", Icon: LayoutGrid };

export const ADMIN_NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { id: "communities", label: "Communities", Icon: Building2, count: true },
      { id: "users", label: "Users", Icon: Users, count: true },
      { id: "kyc", label: "KYC", Icon: ShieldCheck },
      { id: "accounts", label: "Payout accounts", Icon: CreditCard },
    ],
  },
  {
    label: "Money",
    items: [
      { id: "payment-links", label: "Payment links", Icon: Link2, count: true },
      { id: "transactions", label: "Transactions", Icon: ArrowLeftRight, count: true },
      { id: "obligations", label: "Obligations", Icon: FileClock, count: true },
      { id: "settlements", label: "Settlements", Icon: Landmark, count: true },
      { id: "balances", label: "Balances", Icon: BarChart2 },
      { id: "reconciliation", label: "Reconciliation", Icon: Scale },
    ],
  },
  {
    label: "Platform",
    items: [
      { id: "audit-logs", label: "Audit logs", Icon: FileText },
      { id: "notifications", label: "Notification jobs", Icon: Bell },
      { id: "system-config", label: "System config", Icon: SlidersHorizontal },
    ],
  },
];

export const ADMIN_NAV_ITEMS = [ADMIN_NAV_TOP, ...ADMIN_NAV_GROUPS.flatMap((group) => group.items)];
export const ADMIN_TAB_IDS = ADMIN_NAV_ITEMS.map((item) => item.id);
