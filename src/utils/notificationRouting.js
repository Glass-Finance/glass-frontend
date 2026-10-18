import { notificationTypeTarget } from "./notificationTypes";

// Maps a notification to the page it's about. notificationType is a fixed
// backend enum (see notificationTypes.js) and is checked first — exact,
// not guessed. The keyword/text heuristic below only runs when the type is
// missing, unrecognized, or maps to no specific page (e.g. GENERAL),
// covering legacy or future-enum notifications gracefully. Returns null
// when no page is clearly more relevant than the notifications list itself
// — callers should treat null as "not a link".
export function notificationTarget(n, { memberApp = false } = {}) {
  const type = n.notificationType ?? n.type ?? "";

  // The community dashboard resolves its community from ?community= (slug or
  // id) — carry the notification's community along so it opens the right one
  // instead of whatever localStorage last held.
  const communityRef = n.community?.slug ?? n.communityId ?? n.community?.id ?? null;

  if (type === "RECORD_IMPORT_STATUS") {
    if (memberApp || !communityRef) return null;
    const jobId =
      n.content?.jobId ?? (n.relatedEntityType === "RecordImportJob" ? n.relatedEntityId : null);
    return `/dashboard/records/imports${jobId ? `/${encodeURIComponent(jobId)}` : ""}?community=${encodeURIComponent(communityRef)}`;
  }

  const exact = notificationTypeTarget(type, { memberApp, communityRef });
  if (exact) return exact;

  const text =
    `${n.title ?? n.subject ?? ""} ${n.description ?? n.message ?? n.bodyText ?? n.body ?? ""}`.toUpperCase();
  const upperType = type.toUpperCase();
  const has = (...words) => words.some((w) => upperType.includes(w) || text.includes(w));

  if (memberApp) {
    if (has("AUTO-PAY", "AUTO_PAY", "AUTOPAY", "CARD EXPIR", "SAVED CARD"))
      return "/member/auto-pay";
    if (has("RECEIPT", "SUCCESSFUL", "PAYMENT CONFIRMED", "TRANSACTION"))
      return "/member/transactions";
    if (has("REMIND", "DUE", "OVERDUE", "PAYMENT")) return "/member/upcoming";
    if (has("INVITE")) return "/member/invites";
    if (has("JOIN", "COMMUNITY", "VERIF")) return "/member/communities";
    if (has("PROFILE", "PASSWORD", "SECURITY", "ACCOUNT")) return "/member/settings";
    return null;
  }

  const adminDash = communityRef
    ? `/dashboard/admin?community=${communityRef}`
    : "/dashboard/admin";

  if (has("JOIN_REQUEST", "JOIN REQUEST")) return "/dashboard/join-requests";
  if (has("AUTO-PAY", "AUTO_PAY", "AUTOPAY", "CARD EXPIR"))
    return "/dashboard/settings/finance/auto-pay";
  if (has("PLAN")) return "/dashboard/payments";
  // Payment activity (received/failed/overdue dues) lives on the community
  // dashboard's transactions view, not the plans page.
  if (has("PAYMENT", "TRANSACTION", "RECEIPT", "DUES", "COLLECT", "PAID")) return adminDash;
  if (has("MEMBER", "JOIN", "INVITE")) return "/dashboard/members";
  if (has("PROFILE", "PASSWORD", "SECURITY", "ACCOUNT"))
    return "/dashboard/settings/account/profile";
  return null;
}

// Human labels for the detail view's action button, keyed by route path
// (query strings stripped before lookup).
const ADMIN_ACTION_LABELS = {
  "/dashboard/join-requests": "View join requests",
  "/dashboard/payments": "View payment plans",
  "/dashboard/admin": "Open community dashboard",
  "/dashboard/members": "View members",
  "/dashboard/settings/finance/auto-pay": "Manage Auto-Pay",
  "/dashboard/settings/finance/paystack": "View payout account",
  "/dashboard/settings/account/profile": "Open profile settings",
  "/dashboard/settings/account/security": "Open security settings",
  "/dashboard/settings/community/profile": "Open community settings",
};

const MEMBER_ACTION_LABELS = {
  "/member/auto-pay": "Manage Auto-Pay",
  "/member/transactions": "View transactions",
  "/member/upcoming": "View upcoming payments",
  "/member/invites": "View invitations",
  "/member/communities": "View communities",
  "/member/settings": "Open settings",
  "/member/profile": "Open profile settings",
  "/member/security": "Open security settings",
};

// Where clicking a notification from a cross-community feed (the topbar
// bell dropdown, Communities Home's overview card) should open its full
// notifications list — scoped to the community it actually came from, not
// whatever community happens to be active/last-visited, and routed to the
// right side of the app for this user's role there. Shared so every
// cross-community surface sends a notification to the same place instead
// of each maintaining its own copy that can drift out of sync.
export function notificationsListDestination(n, community) {
  if (community) {
    const ref = community.slug ?? community.id;
    return community.owned
      ? `/dashboard/notifications?community=${ref}&open=${n.id}`
      : `/member/notifications?community=${ref}`;
  }
  return `/dashboard/notifications?open=${n.id}`;
}

// The detail-view variant of notificationTarget: returns { to, label } for
// the "open related page" button, or null when there's no better page.
export function notificationAction(n, opts = {}) {
  const to = notificationTarget(n, opts);
  if (!to) return null;
  const labels = opts.memberApp ? MEMBER_ACTION_LABELS : ADMIN_ACTION_LABELS;
  return {
    to,
    label: to.startsWith("/dashboard/records/imports/")
      ? "View record import"
      : (labels[to.split("?")[0]] ?? "Open related page"),
  };
}
