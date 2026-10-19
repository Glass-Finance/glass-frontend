import {
  AlertTriangle,
  UserX,
  Clock,
  CheckCircle2,
  UserPlus,
  Receipt,
  Settings,
  UserMinus,
  Bell,
  Landmark,
  Undo2,
  FileSpreadsheet,
} from "lucide-react";

// Exact notificationType enum + per-type rules, sourced from the backend's
// documented Notification API schema (NotificationDto.notificationType).
// This replaces substring/keyword guessing as the PRIMARY signal for
// categorizing and routing notifications — callers should fall back to the
// old text-heuristic only when a type is missing or not in this list (e.g.
// legacy data), not use it as the first resort anymore.
//
// Update this file (not the guessing logic elsewhere) when the backend adds
// a new notificationType value.

export const NOTIFICATION_TYPES = [
  "ACCOUNT_VERIFICATION",
  "ACCOUNT_REGISTRATION",
  "PASSWORD_RESET",
  "COMMUNITY_INVITE_SENT",
  "COMMUNITY_INVITE_ACCEPTED",
  "COMMUNITY_INVITE_REVOKED",
  "COMMUNITY_INVITE_EXPIRED",
  "COMMUNITY_ACCOUNT_VERIFIED",
  "JOIN_REQUEST_CREATED",
  "JOIN_REQUEST_APPROVED",
  "JOIN_REQUEST_REJECTED",
  "JOIN_REQUEST_REVOKED",
  "COMMUNITY_SETTINGS_CHANGED",
  // Record-book import progress. The backend emits this in-app for
  // READY_FOR_REVIEW, COMMITTED, FAILED and DISCARDED — including when a
  // commit comes back blocked and the job reopens for review. One type covers
  // the whole lifecycle, so the icon is deliberately neutral rather than
  // green-for-success / red-for-failure: the payload's status, not the type,
  // is what says which of those happened.
  "RECORD_IMPORT_STATUS",
  "PAYMENT_REQUEST_CREATED",
  "PAYMENT_DUE",
  "PAYMENT_OVERDUE",
  "PAYMENT_REMINDER_DUE",
  "PAYMENT_REMINDER_OVERDUE",
  "PAYMENT_RECEIVED",
  "PAYMENT_FAILED",
  "PAYMENT_AUTHORIZATION_DISABLED",
  "REFUND_REQUESTED",
  "SETTLEMENT_COMPLETED",
  "RECONCILIATION_FINDINGS",
  "PROFILE_UPDATED",
  "PROFILE_IMAGE_UPDATED",
  "PASSWORD_UPDATED",
  "EMAIL_UPDATED",
  "ACCOUNT_DELETION_VERIFICATION",
  "ACCOUNT_DELETION_REQUESTED",
  "GENERAL",
];

// The full family of payment-lifecycle types — used by the member app's
// Payments-vs-Community split (a simpler two-bucket scheme than the admin
// dashboard's Urgent/Payments/Members tabs, so it needs its own grouping
// rather than reusing ADMIN_CATEGORY below).
const PAYMENT_TYPES = new Set([
  "PAYMENT_REQUEST_CREATED",
  "PAYMENT_DUE",
  "PAYMENT_OVERDUE",
  "PAYMENT_REMINDER_DUE",
  "PAYMENT_REMINDER_OVERDUE",
  "PAYMENT_RECEIVED",
  "PAYMENT_FAILED",
  "PAYMENT_AUTHORIZATION_DISABLED",
  "REFUND_REQUESTED",
]);

export function isPaymentNotificationType(type) {
  return PAYMENT_TYPES.has((type ?? "").toUpperCase());
}

// Only PAYMENT_RECEIVED is "about" a specific member who made a payment —
// used to decide when a notification avatar should try the payer's photo
// instead of the community logo (a due/reminder/created notification has
// no single member it's "from").
export function isPaymentReceivedType(type) {
  return (type ?? "").toUpperCase() === "PAYMENT_RECEIVED";
}

// Account-level events that are about the reader's own account, not a
// member or a community -- there's no "actor" to extract from the payload
// at all, since the actor is whoever is reading the notification. The
// avatar for these should show the current user's own photo/initials
// (from auth state directly) rather than trying to resolve a community
// logo that doesn't apply here.
const SELF_ACCOUNT_TYPES = new Set([
  "PROFILE_UPDATED",
  "PROFILE_IMAGE_UPDATED",
  "PASSWORD_UPDATED",
  "EMAIL_UPDATED",
  "ACCOUNT_VERIFICATION",
  "ACCOUNT_REGISTRATION",
  "PASSWORD_RESET",
  "ACCOUNT_DELETION_VERIFICATION",
  "ACCOUNT_DELETION_REQUESTED",
]);

export function isSelfAccountType(type) {
  return SELF_ACCOUNT_TYPES.has((type ?? "").toUpperCase());
}

// Per-Figma icon + color per notification type -- most notifications
// (payment lifecycle stages, member-joined, settings changes) aren't
// really "about" a particular person's name the way a photo/initials
// avatar implies; a purpose-built, category-colored icon reads faster and
// doesn't need a name or photo to resolve at all. This takes priority over
// the photo/initials treatment for every type listed here. Self-account
// types (see isSelfAccountType) are deliberately absent -- those show the
// reader's own real photo instead, since there's a genuine person to show.
// bg/fg are a light-tint/solid-tone pair per semantic bucket: red for
// failures/urgent, amber for due-soon, green for success, indigo for new/
// info, gray for neutral account-level notices.
const RED = { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" };
const AMBER = { bg: "var(--color-warning-tint)", fg: "var(--color-warning)" };
const GREEN = { bg: "var(--color-success-tint-2)", fg: "var(--color-success-strong)" };
const INDIGO = { bg: "var(--color-brand-tint-2)", fg: "var(--color-accent-indigo)" };
const GRAY = { bg: "var(--color-stacked-container)", fg: "var(--color-ink-muted)" };

const NOTIFICATION_VISUAL = {
  // Payment lifecycle
  PAYMENT_REQUEST_CREATED: { icon: Receipt, ...INDIGO },
  PAYMENT_DUE: { icon: Clock, ...AMBER },
  PAYMENT_REMINDER_DUE: { icon: Clock, ...AMBER },
  PAYMENT_OVERDUE: { icon: AlertTriangle, ...RED },
  PAYMENT_REMINDER_OVERDUE: { icon: AlertTriangle, ...RED },
  PAYMENT_RECEIVED: { icon: CheckCircle2, ...GREEN },
  PAYMENT_FAILED: { icon: AlertTriangle, ...RED },
  PAYMENT_AUTHORIZATION_DISABLED: { icon: Landmark, ...GRAY },
  REFUND_REQUESTED: { icon: Undo2, ...RED },
  SETTLEMENT_COMPLETED: { icon: CheckCircle2, ...GREEN },
  RECONCILIATION_FINDINGS: { icon: AlertTriangle, ...RED },

  // Community / membership
  JOIN_REQUEST_CREATED: { icon: UserPlus, ...INDIGO },
  JOIN_REQUEST_APPROVED: { icon: CheckCircle2, ...GREEN },
  JOIN_REQUEST_REJECTED: { icon: UserX, ...GRAY },
  JOIN_REQUEST_REVOKED: { icon: UserMinus, ...GRAY },
  COMMUNITY_INVITE_SENT: { icon: UserPlus, ...INDIGO },
  COMMUNITY_INVITE_ACCEPTED: { icon: CheckCircle2, ...GREEN },
  COMMUNITY_INVITE_REVOKED: { icon: UserMinus, ...GRAY },
  COMMUNITY_INVITE_EXPIRED: { icon: Clock, ...GRAY },
  COMMUNITY_ACCOUNT_VERIFIED: { icon: CheckCircle2, ...GREEN },
  COMMUNITY_SETTINGS_CHANGED: { icon: Settings, ...GRAY },

  // Record book
  RECORD_IMPORT_STATUS: { icon: FileSpreadsheet, ...INDIGO },

  GENERAL: { icon: Bell, ...GRAY },
};

export function notificationVisual(type) {
  return NOTIFICATION_VISUAL[(type ?? "").toUpperCase()] ?? null;
}

// Admin dashboard's Urgent / Payment Activity / Community Activity tabs.
const ADMIN_CATEGORY = {
  // Urgent — needs admin attention: money that didn't move, or a security-
  // sensitive account change.
  PAYMENT_FAILED: "urgent",
  PAYMENT_OVERDUE: "urgent",
  PAYMENT_REMINDER_OVERDUE: "urgent",
  PAYMENT_AUTHORIZATION_DISABLED: "urgent",
  REFUND_REQUESTED: "urgent",
  RECONCILIATION_FINDINGS: "urgent",
  ACCOUNT_DELETION_REQUESTED: "urgent",
  ACCOUNT_DELETION_VERIFICATION: "urgent",
  PASSWORD_RESET: "urgent",
  PASSWORD_UPDATED: "urgent",
  EMAIL_UPDATED: "urgent",

  // Payment Activity — routine money-in-motion updates.
  PAYMENT_REQUEST_CREATED: "payment",
  PAYMENT_DUE: "payment",
  PAYMENT_REMINDER_DUE: "payment",
  PAYMENT_RECEIVED: "payment",
  SETTLEMENT_COMPLETED: "payment",

  // Community Activity — membership, invites, verification, settings.
  COMMUNITY_INVITE_SENT: "member",
  COMMUNITY_INVITE_ACCEPTED: "member",
  COMMUNITY_INVITE_REVOKED: "member",
  COMMUNITY_INVITE_EXPIRED: "member",
  COMMUNITY_ACCOUNT_VERIFIED: "member",
  JOIN_REQUEST_CREATED: "member",
  JOIN_REQUEST_APPROVED: "member",
  JOIN_REQUEST_REJECTED: "member",
  JOIN_REQUEST_REVOKED: "member",
  COMMUNITY_SETTINGS_CHANGED: "member",
  ACCOUNT_VERIFICATION: "member",
  ACCOUNT_REGISTRATION: "member",
  PROFILE_UPDATED: "member",
  PROFILE_IMAGE_UPDATED: "member",
  // Record-book import progress is community activity, not money movement and
  // not a security-sensitive account change — it reports on a community's own
  // bookkeeping, so "member" is the bucket, never "urgent" and never "payment".
  RECORD_IMPORT_STATUS: "member",
  GENERAL: "member",
};

// Returns null (not a fallback category) when the type is missing/unknown,
// so callers know to run their own text heuristic instead of guessing here.
export function notificationCategory(type) {
  return ADMIN_CATEGORY[(type ?? "").toUpperCase()] ?? null;
}

// ── Routing ───────────────────────────────────────────────────────────────────
// communityRef (slug/id), when known, is appended to dashboard links that
// open a specific community's admin view.
function adminDash(communityRef) {
  return communityRef ? `/dashboard/admin?community=${communityRef}` : "/dashboard/admin";
}

const ADMIN_TARGET = {
  JOIN_REQUEST_CREATED: () => "/dashboard/join-requests",
  JOIN_REQUEST_APPROVED: () => "/dashboard/join-requests",
  JOIN_REQUEST_REJECTED: () => "/dashboard/join-requests",
  JOIN_REQUEST_REVOKED: () => "/dashboard/join-requests",

  COMMUNITY_INVITE_SENT: () => "/dashboard/members",
  COMMUNITY_INVITE_ACCEPTED: () => "/dashboard/members",
  COMMUNITY_INVITE_REVOKED: () => "/dashboard/members",
  COMMUNITY_INVITE_EXPIRED: () => "/dashboard/members",

  COMMUNITY_ACCOUNT_VERIFIED: () => "/dashboard/settings/community/profile",
  COMMUNITY_SETTINGS_CHANGED: () => "/dashboard/settings/community/profile",

  PAYMENT_REQUEST_CREATED: () => "/dashboard/payments",
  PAYMENT_DUE: adminDash,
  PAYMENT_OVERDUE: adminDash,
  PAYMENT_REMINDER_DUE: adminDash,
  PAYMENT_REMINDER_OVERDUE: adminDash,
  PAYMENT_RECEIVED: adminDash,
  PAYMENT_FAILED: adminDash,
  PAYMENT_AUTHORIZATION_DISABLED: () => "/dashboard/settings/finance/auto-pay",
  REFUND_REQUESTED: adminDash,
  SETTLEMENT_COMPLETED: () => "/dashboard/settings/finance/paystack",
  RECONCILIATION_FINDINGS: adminDash,

  ACCOUNT_VERIFICATION: () => "/dashboard/settings/account/profile",
  ACCOUNT_REGISTRATION: () => "/dashboard/settings/account/profile",
  PROFILE_UPDATED: () => "/dashboard/settings/account/profile",
  PROFILE_IMAGE_UPDATED: () => "/dashboard/settings/account/profile",
  PASSWORD_RESET: () => "/dashboard/settings/account/security",
  PASSWORD_UPDATED: () => "/dashboard/settings/account/security",
  EMAIL_UPDATED: () => "/dashboard/settings/account/security",
  ACCOUNT_DELETION_VERIFICATION: () => "/dashboard/settings/account/profile",
  ACCOUNT_DELETION_REQUESTED: () => "/dashboard/settings/account/profile",

  // Record book. Points at the community dashboard rather than a record-book
  // page because none exists yet — the API and hooks landed before the UI.
  // Repoint this to the import wizard's own route when that ships, otherwise
  // an admin who taps "your import is ready for review" lands somewhere that
  // cannot show them the job.
  RECORD_IMPORT_STATUS: adminDash,
};

const MEMBER_TARGET = {
  // A member has no review UI for join requests — the closest useful page
  // is their own communities list (shows pending/active status).
  JOIN_REQUEST_CREATED: () => "/member/communities",
  JOIN_REQUEST_APPROVED: () => "/member/communities",
  JOIN_REQUEST_REJECTED: () => "/member/communities",
  JOIN_REQUEST_REVOKED: () => "/member/communities",

  COMMUNITY_INVITE_SENT: () => "/member/invites",
  COMMUNITY_INVITE_ACCEPTED: () => "/member/invites",
  COMMUNITY_INVITE_REVOKED: () => "/member/invites",
  COMMUNITY_INVITE_EXPIRED: () => "/member/invites",
  COMMUNITY_ACCOUNT_VERIFIED: () => "/member/communities",
  COMMUNITY_SETTINGS_CHANGED: () => "/member/communities",

  PAYMENT_REQUEST_CREATED: () => "/member/upcoming",
  PAYMENT_DUE: () => "/member/upcoming",
  PAYMENT_OVERDUE: () => "/member/upcoming",
  PAYMENT_REMINDER_DUE: () => "/member/upcoming",
  PAYMENT_REMINDER_OVERDUE: () => "/member/upcoming",
  PAYMENT_FAILED: () => "/member/upcoming",
  PAYMENT_RECEIVED: () => "/member/transactions",
  REFUND_REQUESTED: () => "/member/transactions",
  PAYMENT_AUTHORIZATION_DISABLED: () => "/member/auto-pay",

  PROFILE_UPDATED: () => "/member/profile",
  PROFILE_IMAGE_UPDATED: () => "/member/profile",
  ACCOUNT_VERIFICATION: () => "/member/profile",
  ACCOUNT_REGISTRATION: () => "/member/profile",
  PASSWORD_RESET: () => "/member/security",
  PASSWORD_UPDATED: () => "/member/security",
  EMAIL_UPDATED: () => "/member/security",
  ACCOUNT_DELETION_VERIFICATION: () => "/member/profile",
  ACCOUNT_DELETION_REQUESTED: () => "/member/profile",
  // SETTLEMENT_COMPLETED / RECONCILIATION_FINDINGS are admin/finance-ops
  // events — a member shouldn't receive these, so no target is defined;
  // GENERAL has no single destination either.
};

// Returns null when the type is missing/unrecognized, or maps to no page
// (GENERAL) — callers should fall back to their own heuristic in that case.
/**
 * @param {string} type
 * @param {{ memberApp?: boolean, communityRef?: string|null }} [opts]
 */
export function notificationTypeTarget(type, { memberApp = false, communityRef } = {}) {
  const table = memberApp ? MEMBER_TARGET : ADMIN_TARGET;
  const fn = table[(type ?? "").toUpperCase()];
  return fn ? fn(communityRef) : null;
}
