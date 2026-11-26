import { useRef } from "react";

// One editable cell of a custom column in the Member Payments table.
//
// `value` is what the admin has saved for this row, or undefined if they
// haven't touched it. In that case the column's default is shown in muted
// grey (Figma's "Default Value" cells) without being saved as the row's value.

const baseCls =
  "w-full min-w-[120px] h-8 rounded-md border border-transparent bg-transparent px-2 text-xs outline-none transition-colors hover:border-surface-container-border focus:border-[#002FA7] focus:bg-white";

export default function CustomColumnCell({ column, value, onChange, disabled = false }) {
  const isDefault = value === undefined && !!column.defaultValue;
  const shown = value ?? column.defaultValue ?? "";
  const tone = isDefault || shown === "" ? "text-gray-400" : "text-black";

  const inputRef = useRef(null);
  const draftKey = `${column.id}:${shown}`;

  if (column.type === "dropdown") {
    return (
      <select
        aria-label={column.name}
        value={shown}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseCls} cursor-pointer ${tone}`}
      >
        <option value="">{column.label || column.name}</option>
        {column.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (column.type === "date") {
    return (
      <input
        type="date"
        aria-label={column.name}
        value={shown}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseCls} cursor-pointer ${tone}`}
      />
    );
  }

  // Text: commit on blur / Enter so we don't save on every keystroke.
  function commit(e) {
    const draft = e.currentTarget.value;
    if (draft !== shown) onChange(draft);
  }

  return (
    <input
      key={draftKey}
      ref={inputRef}
      type="text"
      aria-label={column.name}
      defaultValue={shown}
      disabled={disabled}
      maxLength={100}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = shown;
          e.currentTarget.blur();
        }
      }}
      className={`${baseCls} ${tone}`}
    />
  );
}
