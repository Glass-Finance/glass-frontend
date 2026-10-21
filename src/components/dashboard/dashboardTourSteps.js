import {
  LayoutDashboard,
  Building2,
  Search,
  Plus,
  ListChecks,
  Receipt,
  Settings,
  Users,
  Clock,
  Grid,
  HelpCircle,
  UserPlus,
  Menu,
} from "lucide-react";

export const DASHBOARD_TOUR_SEEN_KEY = "glass_dashboard_tour_seen";

// `target` is a data-tour selector on the real element being described —
// see Sidebar.jsx, Topbar.jsx, AdminDashboard.jsx, and
// MemberPaymentsSection.jsx for the matching data-tour attributes. Steps
// without a target (intro/outro) just center. A step's target doesn't have
// to exist on every screen size -- findValidStep/measure in DashboardTour.jsx
// both check real visibility, not just DOM presence, so e.g. the mobile-menu-button
// step (only rendered md:hidden) is automatically skipped on desktop, and
// topbar-search (only rendered hidden md:block) is automatically skipped
// on mobile, with no separate per-step viewport flag needed.
export const STEPS = [
  {
    icon: LayoutDashboard,
    title: "Welcome to your dashboard",
    body: "This is where you manage your community's dues, members, and payment plans. Let's take a quick look around.",
    target: null,
  },
  {
    icon: Menu,
    title: "Everything else lives behind this menu",
    body: "On a phone, tap here any time to get back to your communities, dashboard, payments, members, and settings.",
    target: '[data-tour="mobile-menu-button"]',
  },
  {
    icon: Building2,
    title: "Switch between communities",
    body: "The icon rail on the far left lists every community you help run — tap one to jump straight into managing it.",
    target: '[data-tour="community-switcher"]',
  },
  {
    icon: LayoutDashboard,
    title: "Move between pages",
    body: "Use this list to get to Dashboard, Payments, Members, Notifications, and Settings for the community you're currently in.",
    target: '[data-tour="sidebar-nav"]',
  },
  {
    icon: Search,
    title: "Search finds members and payments fast",
    body: "Use the search bar at the top to quickly look up members, transactions, and payment links without leaving the page you're on.",
    target: '[data-tour="topbar-search"]',
  },
  {
    icon: Plus,
    title: "Create a plan or add a member in one click",
    body: "These two buttons set up a new payment plan or invite a member without leaving this page.",
    target: '[data-tour="dashboard-header-actions"]',
  },
  // These two only exist on a brand-new community's WelcomeEmptyState,
  // which replaces the header-actions/checklist/table above entirely
  // (see AdminDashboard.jsx's isFreshCommunity branch) -- like every other
  // step here, a missing target just gets skipped by findValidStep, so the
  // two groups never both show for the same community, but whichever one
  // actually rendered gets its own steps instead of silently skipping past
  // the most important thing a new admin can do.
  {
    icon: Plus,
    title: "Start with your first payment plan",
    body: "Every collection begins here — set up dues, a one-time fee, or an event payment in a few clicks.",
    target: '[data-tour="welcome-create-plan"]',
  },
  {
    icon: UserPlus,
    title: "Bring your members in",
    body: "Invite everyone with a shareable link, a CSV upload, or one at a time.",
    target: '[data-tour="welcome-add-members"]',
  },
  {
    icon: ListChecks,
    title: "Follow your Getting Started checklist",
    body: "New communities see a checklist for the essentials — creating a payment plan, adding members, and setting up your payout account. It updates automatically as you complete each step.",
    target: '[data-tour="getting-started-checklist"]',
  },
  {
    icon: Receipt,
    title: "Every transaction, in one table",
    body: "Search, sort, and export a community's payments here — each row also has a receipt you can download and hand to a member.",
    target: '[data-tour="member-payments-table"]',
  },
  {
    icon: Settings,
    title: "You're all set",
    body: "That covers the basics. You can replay this tour any time from the dashboard menu.",
    target: null,
  },
];

// Shown instead of STEPS when the tour is opened from Community Home (the
// cross-community overview, not a single community's dashboard) -- STEPS
// above is written entirely in singular-community language ("this is where
// you manage your community's dues"), which doesn't fit this page. Kept
// deliberately non-overlapping with STEPS: the sidebar/community-switcher
// steps stay owned by the dashboard tour since they matter most once you're
// actually inside a community.
export const COMMUNITIES_HOME_STEPS = [
  {
    icon: Users,
    title: "Welcome to Your Communities",
    body: "This is your home base across every community you help run or belong to — payments, activity, and notifications from all of them in one place.",
    target: null,
  },
  {
    icon: Plus,
    title: "Start or join a community",
    body: "Create a new community from scratch, or join one you've already been invited to. Creating one first asks you to verify your identity — it only takes a few minutes.",
    target: '[data-tour="communities-home-actions"]',
  },
  {
    icon: Clock,
    title: "Everything due, across every community",
    body: "Upcoming payments, recent activity, and notifications from everywhere you're a member — no need to check each community separately.",
    target: '[data-tour="global-overview"]',
  },
  {
    icon: Grid,
    title: "Sort and switch views",
    body: "Reorder your communities or switch between grid and list view, whichever's easier to scan.",
    target: '[data-tour="communities-view-controls"]',
  },
  {
    icon: Building2,
    title: "Tap a community to manage it",
    body: "Click any card to jump straight into that community's dashboard, payments, and members.",
    target: '[data-tour="communities-grid"]',
  },
  {
    icon: HelpCircle,
    title: "That's the overview",
    body: "You can replay this any time from the dashboard menu.",
    target: null,
  },
];
