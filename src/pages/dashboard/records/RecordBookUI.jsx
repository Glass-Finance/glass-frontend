import { Button } from "../../../components/ui/Button";
import { TextInput } from "../../../components/ui/TextInput";
import { errorDescription } from "../../../utils/recordBook";

export function Field({ label, error, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm text-ink-muted">
      <span>{label}</span>
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
  ...rest
}) {
  return (
    <Field label={label}>
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full min-h-12 rounded-g-1 border border-outline-input/40 bg-white px-3 text-base md:text-sm focus:border-brand outline-none disabled:opacity-50"
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
export function SearchField({ value, onChange, placeholder = "Search records" }) {
  return (
    <Field label="Search">
      <TextInput
        aria-label="Search records"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </Field>
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
          size="sm"
          fullWidth={false}
          className="mt-2"
        >
          Refresh
        </Button>
      )}
    </div>
  );
}
export function QueryState({ query, empty, children }) {
  if (query.isPending)
    return (
      <p role="status" className="p-6 text-sm text-ink-muted">
        Loading…
      </p>
    );
  if (query.error) return <ErrorNotice error={query.error} onRetry={() => query.refetch()} />;
  if (empty) return <p className="p-6 text-sm text-ink-muted">No records match this view.</p>;
  return children;
}
export function Pager({ data, page, onChange, disabled = false }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 text-sm text-ink-muted">
      <span>
        {data?.totalElements ?? 0} records · Page {page} of {Math.max(1, data?.totalPages ?? 1)}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline-neutral"
          size="sm"
          fullWidth={false}
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline-neutral"
          size="sm"
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
