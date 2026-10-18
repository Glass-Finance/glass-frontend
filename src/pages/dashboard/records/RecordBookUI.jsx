import EmptyState from "../../../components/common/EmptyState";
import { BookOpen, Search } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { TextInput } from "../../../components/ui/TextInput";
import { errorDescription } from "../../../utils/recordBook";

export function Field({ label, error, children, hideLabel = false }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs text-ink-muted">
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
      {children}
      {error && <span className="text-danger text-xs">{error}</span>}
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
  empty = "All",
  compact = false,
  hideLabel = false,
  ...rest
}) {
  return (
    <Field label={label} hideLabel={hideLabel}>
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full rounded-g-1 border border-surface-container-border bg-white px-3 text-base md:text-xs focus:border-brand outline-none disabled:opacity-50 ${compact ? "h-11 md:h-9" : "h-12"}`}
        {...rest}
      >
        {empty !== null && <option value="">{empty}</option>}
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function SearchField({ value, onChange, placeholder = "Search records…" }) {
  return (
    <label className="relative block w-full md:w-72">
      <span className="sr-only">Search records</span>
      <Search
        size={13}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-ghost z-1"
      />
      <TextInput
        aria-label="Search records"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 md:h-9 pl-8! py-2! md:text-xs border-surface-container-border"
      />
    </label>
  );
}

export function ErrorNotice({ error, message, onRetry }) {
  if (!error && !message) return null;
  const status = error?.response?.status;
  const text =
    message ||
    (status === 403
      ? "You don't have access to this action in this community."
      : status === 404
        ? "This item is no longer available in this community."
        : errorDescription(error));
  return (
    <div
      role="alert"
      className="rounded-g-1 border border-danger/20 bg-danger-wash p-3 text-sm text-danger"
    >
      <p>{text}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline-caution"
          size="xs"
          fullWidth={false}
          className="mt-2"
        >
          Refresh
        </Button>
      )}
    </div>
  );
}
export function QueryState({
  query,
  empty,
  children,
  emptyTitle = "No records found",
  emptyDescription = "Add a record, import a spreadsheet, or adjust your filters.",
  emptyIcon = BookOpen,
}) {
  if (query.isPending)
    return (
      <p role="status" className="p-6 text-sm text-ink-muted">
        Loading…
      </p>
    );
  if (query.error) return <ErrorNotice error={query.error} onRetry={() => query.refetch()} />;
  if (empty)
    return (
      <div className="rounded-g-3 border border-surface-container-border bg-surface-container">
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          subtitle={emptyDescription}
          className="py-16"
        />
      </div>
    );
  return children;
}
export function Pager({ data, page, onChange, disabled = false, noun = "records" }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-ink-ghost">
      <span>
        {data?.totalElements ?? 0} {data?.totalElements === 1 ? noun.replace(/s$/, "") : noun}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline-neutral"
          size="xs"
          fullWidth={false}
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page} of {Math.max(1, data?.totalPages ?? 1)}
        </span>
        <Button
          variant="outline-neutral"
          size="xs"
          fullWidth={false}
          disabled={disabled || page >= (data?.totalPages ?? 1)}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
