export function usageDate(value, timezone) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  /** @type {Intl.DateTimeFormatOptions} */
  const options = {
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
    // A missing or unsupported profile timezone must not break usage screens.
    delete options.timeZone;
    return date.toLocaleString(undefined, options);
  }
}
