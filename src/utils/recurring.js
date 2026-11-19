// Plain-English descriptions of recurring plans, shared by every surface
// where someone confirms a payment (member PaymentSummary, admin pay modal):
// what renews, how often, and roughly when the next charge lands.

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const FREQ_UNITS = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  QUARTERLY: "quarter",
  ANNUALLY: "year",
};

const FREQ_ADVERB = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  ANNUALLY: "annually",
};

export function recurringPeriodLabel(frequency, interval) {
  const cadence = (frequency ?? "").toUpperCase();
  const unit = cadence === "CUSTOM" ? "day" : FREQ_UNITS[cadence];
  if (!unit) return null;
  return interval > 1 ? `${interval} ${unit}s` : unit;
}

// Short adverb form ("monthly") for copy like "charge you X automatically
// for Y monthly?" -- scheduleCopy() below is a fuller sentence ("Every
// month on the 5th") meant for a schedule summary, not this shorter slot.
export function frequencyAdverb(frequency) {
  return FREQ_ADVERB[(frequency ?? "").toUpperCase()] ?? "regularly";
}

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

// "Every 2 weeks on Mondays" / "Every month on the 5th" / "Every quarter"
export function scheduleCopy(plan) {
  const freq = (plan?.frequency ?? "").toUpperCase();
  const interval = Number(plan?.interval) || 1;
  const unit = FREQ_UNITS[freq] ?? "cycle";
  const every = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
  const day = Number(plan?.billingDay);
  if (freq === "WEEKLY" && day >= 1 && day <= 7) return `${every} on ${WEEKDAY_NAMES[day - 1]}s`;
  if (freq !== "DAILY" && day) return `${every} on the ${ordinal(day)}`;
  return every;
}

// Best-effort estimate of the charge after this one — one interval past the
// current due date (or today when the due date isn't known, e.g. via-link).
export function estimateNextCharge(plan, fromDateStr) {
  const freq = (plan?.frequency ?? "").toUpperCase();
  const interval = Number(plan?.interval) || 1;
  const from = fromDateStr ? new Date(fromDateStr) : new Date();
  if (isNaN(from.getTime())) return null;
  const d = new Date(from);
  switch (freq) {
    case "DAILY":
      d.setDate(d.getDate() + interval);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + 7 * interval);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + interval);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3 * interval);
      break;
    case "ANNUALLY":
      d.setFullYear(d.getFullYear() + interval);
      break;
    default:
      return null;
  }
  return d;
}
