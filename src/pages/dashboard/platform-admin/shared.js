// Shared formatters, pagination helpers, and the status-color lookup used
// across every PlatformAdmin section.

import { formatNaira } from "../../../utils/format";
import { normalizeImageObject } from "../../../utils/normalizeImageFields";

// Admin response amounts are already in major currency units: transactions,
// settlements, payment links (including metrics), obligations, balances, and
// reconciliation findings are converted by the backend before serialization.
// Format those values directly, with two decimal places. Only explicitly
// identified minor-unit fields may opt into conversion with { minor: true }.
// `currency` is almost always "NGN" in practice, but settlement/reconciliation
// records carry their own currency field, so it stays parameterized rather
// than assuming NGN outright.
export function fmt(amount, currency = "NGN", { minor = false, decimals = 2 } = {}) {
  if (amount == null) return "—";
  if (currency === "NGN") return formatNaira(amount, { decimals, minor });
  const value = minor ? amount / 100 : amount;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function unwrap(res) {
  const d = res.data?.data;
  return {
    content: Array.isArray(d) ? d : (d?.content ?? []),
    totalElements: d?.totalElements ?? 0,
    totalPages: d?.totalPages ?? 1,
  };
}

// SECURITY: the platform-admin sections each run their own inline useQuery
// (they don't share one of the member-side community hooks), so their
// server-controlled `logo` can't be covered by the boundary work elsewhere in
// this change. Normalizing here — right next to `unwrap`, which is the other
// piece every one of those queries already funnels through — keeps the fix to
// this folder instead of a new global normalizer. Takes and returns the whole
// unwrapped page envelope so pagination fields survive untouched.
export function withSafeCommunityLogos(page) {
  if (!page?.content?.length) return page;
  return {
    ...page,
    content: page.content.map((c) => (c?.logo ? { ...c, logo: normalizeImageObject(c.logo) } : c)),
  };
}

export const PAGE_SIZE = 20;

// The shell's ⌘K palette jumps with ?tab=…&q=… (AdminTopbar.jump); PlatformAdmin
// remounts the section on a q change, so each section seeds both its visible
// and debounced search from here on mount and the first query already carries
// the term. window.location rather than useSearchParams: these sections are
// also rendered directly in unit tests, outside a router.
export function initialSearchFromUrl() {
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

// Backend pagination DTOs (CommunityQueryDto, AdminUserQueryDto, and other
// admin query DTOs) all extend a shared PageQueryDto with fields:
// { search, pageNumber, pageSize, sortBy, dir } — NOT `page`/`size`.
// Sending `page`/`size` gets silently ignored, so the backend falls back to
// its own defaults regardless of what's clicked in the UI (looks like
// "pagination is broken" but is really a param-name mismatch).
//
// NOTE ON INDEXING: local React state (`page`, the Pager component) stays
// 0-indexed — that's just UI state and is unaffected by this change.
// The backend's `pageNumber` is 1-indexed, confirmed by a 400 "Illegal
// Argument Entered" (IllegalArgumentException) returned for `pageNumber=0`
// on every admin list endpoint — consistent with a `@Min(1)` validation
// constraint on the shared PageQueryDto. So we add 1 when building the
// request and nothing else needs to change.
export function pageParams(page, size = PAGE_SIZE) {
  return { pageNumber: page + 1, pageSize: size };
}

export const STATUS_COLORS = {
  ACTIVE: { bg: "bg-green-50", text: "text-green-700" },
  PENDING: { bg: "bg-amber-50", text: "text-amber-700" },
  PENDING_ONBOARDING: { bg: "bg-amber-50", text: "text-amber-700" },
  SUSPENDED: { bg: "bg-red-50", text: "text-red-700" },
  INACTIVE: { bg: "bg-gray-100", text: "text-gray-500" },
  VERIFIED: { bg: "bg-green-50", text: "text-green-700" },
  // CommunityAccountResponse.status enum (accounts review flow). DISABLED
  // isn't listed here on purpose — it falls through to the default gray
  // badge below, which already reads correctly for a disabled state.
  UNVERIFIED: { bg: "bg-amber-50", text: "text-amber-700" },
  REJECTED: { bg: "bg-red-50", text: "text-red-700" },
  NEED_MORE_INFORMATION: { bg: "bg-orange-50", text: "text-orange-700" },
  DRAFT: { bg: "bg-gray-100", text: "text-gray-500" },
  EXPIRED: { bg: "bg-gray-100", text: "text-gray-500" },
  ARCHIVED: { bg: "bg-gray-100", text: "text-gray-500" },
  PAUSED: { bg: "bg-amber-50", text: "text-amber-700" },
  COMPLETED: { bg: "bg-blue-50", text: "text-blue-700" },
  FAILED: { bg: "bg-red-50", text: "text-red-700" },
  SUCCESS: { bg: "bg-green-50", text: "text-green-700" },
  ONE_TIME: { bg: "bg-blue-50", text: "text-blue-700" },
  RECURRING: { bg: "bg-purple-50", text: "text-purple-700" },
  // Present in the CommunityQueryDto status enum but were missing here,
  // so they fell through to the default gray badge (see screenshot: a
  // DELETED community rendered unstyled). Added so the badge — and the
  // Communities status filter below — can represent every valid status.
  DELETING: { bg: "bg-amber-50", text: "text-amber-700" },
  DELETED: { bg: "bg-gray-100", text: "text-gray-500" },
  // Settlement / reconciliation statuses — the Swagger spec's example
  // values ("PENDING", "NEW", "CRITICAL"...) aren't an exhaustive enum
  // list, so unlisted values still fall back to the default gray badge.
  MATCHED: { bg: "bg-green-50", text: "text-green-700" },
  MISMATCHED: { bg: "bg-red-50", text: "text-red-700" },
  RUNNING: { bg: "bg-blue-50", text: "text-blue-700" },
  NEW: { bg: "bg-amber-50", text: "text-amber-700" },
  REVIEWED: { bg: "bg-blue-50", text: "text-blue-700" },
  RESOLVED: { bg: "bg-green-50", text: "text-green-700" },
  CRITICAL: { bg: "bg-red-50", text: "text-red-700" },
  HIGH: { bg: "bg-red-50", text: "text-red-700" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-700" },
  LOW: { bg: "bg-gray-100", text: "text-gray-500" },
  // KYC attempt / account statuses (kyc-frontend-integration.md).
  NOT_STARTED: { bg: "bg-gray-100", text: "text-gray-500" },
  INITIATED: { bg: "bg-amber-50", text: "text-amber-700" },
  PROCESSING: { bg: "bg-amber-50", text: "text-amber-700" },
  IN_REVIEW: { bg: "bg-amber-50", text: "text-amber-700" },
  APPROVED: { bg: "bg-green-50", text: "text-green-700" },
  REVOKED: { bg: "bg-red-50", text: "text-red-700" },
};
