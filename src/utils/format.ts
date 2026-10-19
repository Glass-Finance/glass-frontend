// Shared display-formatting helpers, consolidated out of ~15-20 near-identical
// per-file copies. Signatures below match the majority behavior found across
// those copies; options exist only where a real caller needed a genuine
// difference (e.g. 2-decimal receipts, null-as-dash).

// Branded so a caller can't pass a naira number where a kobo number is
// expected (or vice versa) without an explicit cast -- see AUDIT_REPORT.md,
// F14. This backend is inconsistent about which fields are minor-unit
// (kobo) vs major-unit (naira), and until now that distinction was tracked
// only in comments; a wrong `minor` flag silently produces a 100x-wrong
// displayed amount. Existing .jsx callers are untyped and unaffected --
// this only starts enforcing anything for new/converted TS callers, which
// is the point of an incremental adoption.
export type Kobo = number & { readonly __brand: "Kobo" };
export type Naira = number & { readonly __brand: "Naira" };

// No runtime validation here deliberately -- these exist purely to make the
// *source* of a value explicit at the call site (e.g. `asKobo(response.data.amountMinor)`),
// not to check that the backend actually sent minor units. That trust boundary
// is still the caller's to get right; the type system only keeps it from
// being silently forgotten past that point.
export function asKobo(n: number): Kobo {
  return n as Kobo;
}
export function asNaira(n: number): Naira {
  return n as Naira;
}

type FormatNairaOptions = {
  decimals?: number;
  emptyDash?: boolean;
  minor?: boolean;
};

// "₦12,000" by default. Pass { decimals: 2 } for receipt-style precision,
// { emptyDash: true } to render "—" for null/undefined instead of "₦0"
// (a few dashboard summary cards want that distinction), { minor: true }
// when `amount` is in kobo and needs dividing by 100 first (most admin
// balance/commission fields on this backend are minor-unit).
//
// Overloaded so { minor: true } requires a Kobo-branded amount and the
// naira path accepts a Naira-branded amount or a plain number (existing
// untyped callers pass plain numbers; this keeps them compiling once
// they're eventually converted, without forcing every call site to adopt
// the branded types on day one).
export function formatNaira(
  amount: Kobo | null | undefined,
  options: FormatNairaOptions & { minor: true },
): string;
export function formatNaira(
  amount: Naira | number | null | undefined,
  options?: FormatNairaOptions & { minor?: false },
): string;
export function formatNaira(
  amount: number | null | undefined,
  { decimals = 0, emptyDash = false, minor = false }: FormatNairaOptions = {},
): string {
  if (emptyDash && (amount === null || amount === undefined)) return "—";
  const value = minor ? (amount ?? 0) / 100 : (amount ?? 0);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(value)
    .replace("NGN", "₦");
}

// Abbreviated form for tight stat rows: "₦1.20M", "₦4.8K". Falls back to
// formatNaira below the K threshold. Naira-only (no minor-unit variant has
// been needed yet) -- accepts a plain number since every current caller is
// still untyped .jsx.
export function formatNairaCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const n = Number(amount);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`;
  return formatNaira(n as Naira);
}

export function toTitleCase(str: string | null | undefined): string | null | undefined {
  if (!str) return str;
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Pascal-case a *person's* name for display: "cynthia ee" -> "Cynthia Ee".
// Separate from toTitleCase above on purpose. toTitleCase is shared by ~30
// call sites that also format bank names, card types and payment channels,
// and those must NOT have their tails lowercased -- "MTN" has to stay "MTN",
// not become "Mtn". Only names get the lowercase-tail treatment.
//
// Two things pass through untouched, per the design owner:
//   - anything containing an apostrophe ("O'Shea") -- the capitalisation
//     around the apostrophe is the person's own choice, so don't second-guess it
//   - anything containing a non-ASCII character ("maría") -- accents stay
//     intact and the surrounding case is preserved
export function toPascalCaseName(str: string | null | undefined): string | null | undefined {
  if (!str) return str;
  const trimmed = str.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes("'") || /[^\x00-\x7F]/.test(trimmed)) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

type DateInput = string | number | Date | null | undefined;

// "Jul 11, 2026" — the dominant date-display style across the app.
export function formatDate(d: DateInput): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// "Jul 11" — no year, for contexts where the year is implied (due dates,
// recent activity) and the extra characters aren't worth the space.
export function formatDateShort(d: DateInput): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
  });
}

// "11 July 2026" — used where a fuller, non-abbreviated date reads better.
export function formatDateLong(d: DateInput): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// "Today 6:42" / "Yesterday 6:41" / "Jul 9, 6:30" — the relative timestamp
// style used by notification lists.
export function formatRelativeDateTime(dateStr: DateInput): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-NG", { month: "short", day: "numeric" })}, ${time}`;
}

// "Today" / "Yesterday" / "This Week" / a full date for anything older —
// the date-separator bucketing used by both notification lists.
export function dayLabel(dateStr: DateInput): string {
  if (!dateStr) return "Earlier";
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays >= 0 && diffDays < 7) return "This Week";
  return d.toLocaleDateString("en-NG", { weekday: "long", month: "short", day: "numeric" });
}

// Renders an instant as a readable date and time, in the reader's own
// timezone, with the zone's short label ("GMT+1", "WAT") so the reader can
// tell which clock they are looking at.
//
// The zone comes from the signed-in user's profile, so it can be a valid IANA
// zone ("Africa/Lagos"), an empty string, or a zone this runtime does not
// know. All three have to render something: a usage or allowance screen that
// renders nothing at all is worse than one that renders the browser's own
// zone. An unusable zone is therefore dropped and the browser default is
// used, rather than the whole value failing.
//
// The browser's own locale is used rather than the "en-NG" the formatters
// above use: this value is read by one person, in their own locale, and a
// reader in Lagos and a reader in London should not be shown the same words
// for the same instant.
//
// Anything that is not a real instant reads as "Unavailable" — a screen that
// silently shows a wrong date is worse than one that admits it has no date.
export function formatDateTime(value: DateInput, timezone?: string | null): string {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  };
  if (typeof timezone === "string" && timezone.trim()) options.timeZone = timezone.trim();
  try {
    return date.toLocaleString(undefined, options);
  } catch {
    // The runtime rejected the zone (unknown or malformed IANA name). Fall
    // back to the browser's own zone instead of losing the value.
    delete options.timeZone;
    return date.toLocaleString(undefined, options);
  }
}
