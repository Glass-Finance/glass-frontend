// Shared constants for the payment-plan modals/wizard (Payments.jsx and its
// extracted pieces under this folder). Split out so each file only imports
// what it actually needs instead of every consumer redeclaring these.

export const PLAN_STATUS = {
  ACTIVE: {
    cls: "bg-success-wash text-success-strong",
    dotCls: "bg-success-strong",
    label: "Active",
  },
  PAUSED: { cls: "bg-warning-wash text-warning", dotCls: "bg-warning", label: "Paused" },
  DRAFT: { cls: "bg-[#f5f6fa] text-ink-muted", dotCls: "bg-ink-muted", label: "Draft" },
  EXPIRED: {
    cls: "bg-danger-wash-2 text-danger-bright",
    dotCls: "bg-danger-bright",
    label: "Inactive",
  },
  // DELETED replaced ARCHIVED in glass-backend #120: every archived link was
  // migrated to it, so it keeps the label archived plans had ("Inactive").
  DELETED: {
    cls: "bg-danger-wash-2 text-danger-bright",
    dotCls: "bg-danger-bright",
    label: "Inactive",
  },
};

// NOTE: value must match the backend's RecurringPlanRequest.frequency enum
// exactly (DAILY | WEEKLY | MONTHLY | QUARTERLY | ANNUALLY | CUSTOM).
// Previously this used "YEARLY", which is not a valid enum value on the
// backend — any yearly plan created before this fix would have failed
// validation or been silently rejected server-side.
export const FREQUENCIES = [
  { label: "Daily", value: "DAILY" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
  { label: "Quarterly", value: "QUARTERLY" },
  { label: "Annually", value: "ANNUALLY" },
];

// Matches RecurringPlanRequest.retryPolicy enum.
export const RETRY_POLICIES = [
  { label: "No retry", value: "NO_RETRY" },
  { label: "Retry every 24 hours", value: "EVERY_24H" },
  { label: "Retry with backoff (7 days)", value: "EXPONENTIAL_BACKOFF_7D" },
];

// Matches PaymentAmountMode (FIXED | MINIMUM | SUGGESTED | VARIABLE).
// The labels are deliberately short: these render inside a half-width select
// with ~173px of usable text, and a closed native select clips rather than
// wraps, so the longer "…— members pay at least this" phrasing was unreadable
// once chosen. What each mode MEANS is carried by the field hint under the
// amount input, not by the option text.
export const AMOUNT_MODES = [
  { label: "Fixed amount", value: "FIXED" },
  { label: "Minimum amount", value: "MINIMUM" },
  { label: "Suggested amount", value: "SUGGESTED" },
  { label: "Any amount", value: "VARIABLE" },
];

// Matches PaymentVisibility (PUBLIC | MEMBERS_ONLY | PRIVATE). PRIVATE is not
// "hidden": the link only works for the plan's AUDIENCE, which may or may not
// be a hand-picked list. The old "Only the selected members" wording was
// actively wrong for an ALL_MEMBERS audience, where nothing is selected and no
// member picker is even on screen.
export const VISIBILITY_OPTIONS = [
  { label: "Anyone with the link", value: "PUBLIC" },
  { label: "Community members", value: "MEMBERS_ONLY" },
  { label: "Plan audience only", value: "PRIVATE" },
];

// Matches the backend's PaymentAudience enum (ALL_MEMBERS | GROUP |
// SELECTED_MEMBERS). GROUP is offered because the community-groups endpoints
// it depends on now exist and are wired up (src/api/groups.js, the Groups
// page) — the earlier note that this app had "no surface for at all" was
// written before that feature landed and no longer holds.
//
// Qualification worth keeping: GROUP is only usable once the community has at
// least one ACTIVE group, and the backend rejects an empty groupIds on both its
// create and PATCH paths ("Group audience requires at least one group"). It is
// also gated behind the caller's community permissions — a community staff
// member whose KYC isn't approved gets a 403 from the groups list, which the
// picker surfaces rather than showing an empty list.
export const AUDIENCE_OPTIONS = [
  { label: "All members", value: "ALL_MEMBERS" },
  { label: "Specific members", value: "SELECTED_MEMBERS" },
  { label: "Specific groups", value: "GROUP" },
];

// One string per audience, three call sites each: both modals' validation and
// the inline hint under the picker. It has to be shown proactively rather than
// on submit, because the Continue/Save button is disabled while the selection
// is empty — a message that only appears after clicking a disabled button is a
// message nobody ever sees.
export const AUDIENCE_EMPTY_MESSAGE = "Choose at least one member for this plan to bill.";
export const AUDIENCE_GROUP_EMPTY_MESSAGE = "Choose at least one group for this plan to bill.";

/**
 * The "pick at least one" message for an audience that requires a selection.
 *
 * ALL_MEMBERS needs nothing, so it returns "" — the caller treats that as
 * "ready" rather than special-casing the audience at each site.
 */
export function audienceEmptyMessage(audience) {
  if (audience === "SELECTED_MEMBERS") return AUDIENCE_EMPTY_MESSAGE;
  if (audience === "GROUP") return AUDIENCE_GROUP_EMPTY_MESSAGE;
  return "";
}

// Singular unit label per frequency, used to build the "repeat every N ___"
// copy next to the interval input.
export const FREQUENCY_UNIT_LABEL = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  QUARTERLY: "quarter",
  ANNUALLY: "year",
};

// Weekday names for WEEKLY billing — backend expects 1=Monday … 7=Sunday.
export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Confirmed against the backend's actual enum (com.glassfinance.backend.
// model.enums.ReminderFrequency) via a 500 error that listed every accepted
// value — there is no daily option; EVERY_3_DAYS is the most frequent one
// available. DISABLED is a real member too (the "off" state is an explicit
// value, not just an omitted field) — handled separately in the payload
// builders below, not offered as a selectable option here.
export const REMINDER_FREQUENCIES = [
  { label: "Every 3 Days", value: "EVERY_3_DAYS" },
  { label: "Every Week", value: "WEEKLY" },
  { label: "Every 2 Weeks", value: "BIWEEKLY" },
  { label: "Every Month", value: "MONTHLY" },
];
// Matches the notification API's channel enum (IN_APP | EMAIL | WHATSAPP).
export const REMINDER_CHANNELS = [
  { label: "In-app notification", value: "IN_APP" },
  { label: "Email", value: "EMAIL" },
  { label: "WhatsApp", value: "WHATSAPP" },
];
export const TABS = ["All Plans", "Recurring", "One Time"];
export const BAR_COLOR_CLASSES = [
  "bg-accent-gold",
  "bg-accent-purple",
  "bg-brand",
  "bg-success-strong",
];

export const inputCls =
  "w-full h-12 min-h-8 px-4 py-1 rounded-lg border-[1.5px] border-gray-200 text-placeholder text-black placeholder-black/60 outline-none transition-all focus:border-brand";

// Description field is taller (128px, per Figma) with real top padding
// instead of reusing the single-line field's vertically-centered py-1 --
// a textarea needs the text to start at the top, not float mid-box.
// Padding and radius are deliberately asymmetric to match the Figma spec
// exactly (top 24 / right 24 / bottom 4 / left 16, radius 16).
export const textareaCls =
  "w-full h-32 pt-6 pr-6 pb-1 pl-4 rounded-2xl border-[1.5px] border-gray-200 text-placeholder text-gray-700 outline-none transition-all resize-none focus:border-brand";
