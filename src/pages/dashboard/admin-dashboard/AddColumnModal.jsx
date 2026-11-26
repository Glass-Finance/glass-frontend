import { useEffect, useRef, useState } from "react";
import { X, Check } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import TextIcon from "../../../assets/dashboard/custom-columns/text.svg";
import DropdownIcon from "../../../assets/dashboard/custom-columns/dropdown.svg";
import CalendarIcon from "../../../assets/dashboard/custom-columns/calendar.svg";
import AddIcon from "../../../assets/dashboard/custom-columns/add.svg";
import DeleteIcon from "../../../assets/dashboard/custom-columns/delete.svg";

// Figma: "Add Custom Column" (MacBook Pro 14" 176-180).
// Dropdown label + Options only exist for the Dropdown field type (design
// comment from sulaimana5446). Text and Date show just the default value.

const FIELD_TYPES = [
  { value: "text", label: "Text", icon: TextIcon },
  { value: "dropdown", label: "Dropdown", icon: DropdownIcon },
  { value: "date", label: "Date", icon: CalendarIcon },
];

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 20;
const NAME_MAX = 40;
const DEFAULT_MAX = 100;
const OPTION_PLACEHOLDERS = ["Pending", "Paid", "Waived"];
const SUCCESS_MS = 1800;

const inputCls =
  "w-full h-11 rounded-lg border bg-white px-3 text-base md:text-sm text-black placeholder-gray-400 outline-none transition-colors focus:border-[#002FA7]";
const borderOk = "border-surface-container-border";
const borderBad = "border-red-400";

function slugify(label) {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "option"
  );
}

// Labels are unique (validated), but two different labels can slug the same
// ("A b" and "A-b"), so suffix collisions to keep saved values unique too.
function withValues(options) {
  const used = new Set();
  return options.map((o) => {
    const base = slugify(o.label);
    let value = base;
    let n = 2;
    while (used.has(value)) value = `${base}_${n++}`;
    used.add(value);
    return { id: o.id, label: o.label, value };
  });
}

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-xs text-red-500 mt-1.5 mb-0">
      {children}
    </p>
  );
}

function Label({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-black mb-2">
      {children}
    </label>
  );
}

function SuccessView() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-5 px-6 py-24 text-center"
    >
      {/* Swap for the shared SuccessBadge if you prefer the animated one. */}
      <span className="flex items-center justify-center w-16 h-16 rounded-full bg-[#008A00] text-white">
        <Check size={32} strokeWidth={3} />
      </span>
      <p className="text-base font-medium text-black m-0">Column Successfully Added</p>
    </div>
  );
}

export default function AddColumnModal({ onClose, onSubmit, existingNames = [] }) {
  const [name, setName] = useState("");
  const [type, setType] = useState(""); // "" until the admin picks a category
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [dropdownLabel, setDropdownLabel] = useState("");
  const [options, setOptions] = useState([
    { id: 1, label: "" },
    { id: 2, label: "" },
  ]);
  const [defaultText, setDefaultText] = useState("");
  const [defaultOptionId, setDefaultOptionId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [phase, setPhase] = useState("form"); // "form" | "success"

  const nextOptionId = useRef(3);
  const typeMenuRef = useRef(null);
  const nameRef = useRef(null);

  const selectedType = FIELD_TYPES.find((t) => t.value === type) ?? null;
  const isDropdown = type === "dropdown";

  // ── Lifecycle: focus, scroll lock, Escape, outside click ────────────────
  useEffect(() => {
    nameRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (typeMenuOpen) setTypeMenuOpen(false);
      else onClose();
    }
    function onMouseDown(e) {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target)) {
        setTypeMenuOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [onClose, typeMenuOpen]);

  // Close after the success message has been read.
  useEffect(() => {
    if (phase !== "success") return undefined;
    const t = setTimeout(onClose, SUCCESS_MS);
    return () => clearTimeout(t);
  }, [phase, onClose]);

  // ── Validation ───────────────────────────────────────────────────────────
  function validate() {
    const errors = { options: {} };
    const trimmedName = name.trim();
    if (!trimmedName) errors.name = "Enter a column name.";
    else if (trimmedName.length > NAME_MAX)
      errors.name = `Keep the name under ${NAME_MAX} characters.`;
    else if (existingNames.some((n) => n.trim().toLowerCase() === trimmedName.toLowerCase()))
      errors.name = "You already have a column with this name.";

    if (!type) errors.type = "Select a field type.";

    if (isDropdown) {
      const seen = new Set();
      let filled = 0;
      options.forEach((o) => {
        const label = o.label.trim().toLowerCase();
        if (!label) {
          errors.options[o.id] = "Enter an option label.";
          return;
        }
        filled += 1;
        if (seen.has(label)) errors.options[o.id] = "Use a different label. This one is taken.";
        seen.add(label);
      });
      if (filled < MIN_OPTIONS) errors.optionsSummary = `Add at least ${MIN_OPTIONS} options.`;
    } else if (defaultText.length > DEFAULT_MAX) {
      errors.defaultValue = `Keep the default under ${DEFAULT_MAX} characters.`;
    }
    return errors;
  }

  const errors = submitted ? validate() : { options: {} };

  // ── Handlers ─────────────────────────────────────────────────────────────
  function pickType(value) {
    setType(value);
    setTypeMenuOpen(false);
    // A default typed for one field type means nothing for another.
    setDefaultText("");
    setDefaultOptionId("");
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, { id: nextOptionId.current++, label: "" }]);
  }

  function removeOption(id) {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((o) => o.id !== id));
    if (defaultOptionId === id) setDefaultOptionId("");
  }

  function updateOption(id, label) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, label } : o)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setSaveError("");
    const found = validate();
    if (found.name || found.type || found.optionsSummary || found.defaultValue) return;
    if (Object.keys(found.options).length > 0) return;

    const trimmedName = name.trim();
    const withVals = isDropdown
      ? withValues(options.map((o) => ({ ...o, label: o.label.trim() })))
      : [];
    const defaultOption = withVals.find((o) => o.id === defaultOptionId);

    const draft = {
      name: trimmedName,
      type,
      // Falls back to the column name so the cell dropdown always has a placeholder.
      label: isDropdown ? dropdownLabel.trim() || trimmedName : null,
      options: withVals.map(({ label, value }) => ({ label, value })),
      defaultValue: isDropdown ? (defaultOption?.value ?? "") : defaultText.trim(),
    };

    setSaving(true);
    try {
      const ok = await onSubmit(draft);
      if (ok === false) {
        setSaveError("Couldn't add the column. Try again.");
        return;
      }
      setPhase("success");
    } catch {
      setSaveError("Couldn't add the column. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const optionCount = options.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase === "form") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-column-title"
        className="relative w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
      >
        {phase === "success" ? (
          <SuccessView />
        ) : (
          <form onSubmit={handleSubmit} noValidate className="px-6 pt-6 pb-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 id="add-column-title" className="text-lg font-semibold text-black m-0">
                  Add Custom Column
                </h2>
                <p className="text-sm text-gray-500 mt-1 mb-0">
                  Add information your admins need alongside each member&rsquo;s payments.
                </p>
              </div>
              <Button
                variant="tertiary"
                size="icon-sm"
                fullWidth={false}
                onClick={onClose}
                aria-label="Close"
                className="-mt-1 -mr-2 text-gray-500 hover:text-black"
              >
                <X size={22} />
              </Button>
            </div>

            {/* Column name */}
            <div className="mb-5">
              <Label htmlFor="custom-col-name">Column Name</Label>
              <input
                id="custom-col-name"
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={NAME_MAX + 10}
                placeholder="Enter the name of your column"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "custom-col-name-err" : undefined}
                className={`${inputCls} ${errors.name ? borderBad : borderOk}`}
              />
              <FieldError id="custom-col-name-err">{errors.name}</FieldError>
            </div>

            {/* Field type */}
            <div className="mb-5" ref={typeMenuRef}>
              <Label htmlFor="custom-col-type">Field Type</Label>
              <div className="relative">
                <Button
                  id="custom-col-type"
                  variant="outline-neutral"
                  size="sm-tight"
                  aria-haspopup="listbox"
                  aria-expanded={typeMenuOpen}
                  onClick={() => setTypeMenuOpen((o) => !o)}
                  className={`${inputCls} flex items-center justify-between text-left font-normal normal-case ${
                    errors.type ? borderBad : borderOk
                  }`}
                >
                  {selectedType ? (
                    <span className="flex items-center gap-2.5">
                      <img src={selectedType.icon} alt="" className="w-5 h-5" />
                      {selectedType.label}
                    </span>
                  ) : (
                    <span className="text-gray-400">Select a category</span>
                  )}
                  <img src={DropdownIcon} alt="" className="w-6 h-6 flex-shrink-0" />
                </Button>
                {typeMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Field type"
                    className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg border border-surface-container-border bg-white py-1.5 shadow-lg"
                  >
                    {FIELD_TYPES.map((t) => (
                      <Button
                        key={t.value}
                        variant={type === t.value ? "tonal" : "tertiary"}
                        size="sm-tight"
                        fullWidth
                        role="option"
                        aria-selected={type === t.value}
                        onClick={() => pickType(t.value)}
                        className={`justify-start px-4 py-2.5 text-left font-normal ${
                          type === t.value ? "bg-blue-50 text-brand" : "text-black"
                        }`}
                      >
                        <img src={t.icon} alt="" className="w-5 h-5" />
                        {t.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <FieldError>{errors.type}</FieldError>
            </div>

            {/* Dropdown-only: label + options */}
            {isDropdown && (
              <>
                <div className="mb-5">
                  <Label htmlFor="custom-col-dd-label">Dropdown label</Label>
                  <input
                    id="custom-col-dd-label"
                    value={dropdownLabel}
                    onChange={(e) => setDropdownLabel(e.target.value)}
                    placeholder="Payment status"
                    aria-describedby="custom-col-dd-label-hint"
                    className={`${inputCls} ${borderOk}`}
                  />
                  <p id="custom-col-dd-label-hint" className="text-xs text-gray-500 mt-1.5 mb-0">
                    The label appears above the field. The placeholder is shown before a selection.
                  </p>
                </div>

                <fieldset className="mb-5 border-none p-0 m-0 min-w-0">
                  <div className="flex items-center justify-between">
                    <legend className="text-sm font-medium text-black p-0">Options</legend>
                    <span className="text-xs text-gray-500">
                      {optionCount} option{optionCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 mb-3">
                    Enter the labels admins will see and the values saved with each selection.
                  </p>

                  <div className="flex flex-col gap-2.5">
                    {options.map((o, i) => (
                      <div key={o.id}>
                        <div className="flex items-center gap-3">
                          <span className="w-4 text-xs text-gray-500 text-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <input
                            value={o.label}
                            onChange={(e) => updateOption(o.id, e.target.value)}
                            placeholder={OPTION_PLACEHOLDERS[i] ?? `Option ${i + 1}`}
                            aria-label={`Option ${i + 1} label`}
                            aria-invalid={!!errors.options[o.id]}
                            className={`${inputCls} h-10 ${errors.options[o.id] ? borderBad : borderOk}`}
                          />
                          <Button
                            variant="tertiary"
                            size="icon-sm"
                            fullWidth={false}
                            onClick={() => removeOption(o.id)}
                            disabled={optionCount <= MIN_OPTIONS}
                            aria-label={`Remove option ${i + 1}`}
                            title={
                              optionCount <= MIN_OPTIONS
                                ? `At least ${MIN_OPTIONS} options are required`
                                : "Remove option"
                            }
                            className="flex-shrink-0"
                          >
                            <img src={DeleteIcon} alt="" className="w-6 h-6" />
                          </Button>
                        </div>
                        {errors.options[o.id] && (
                          <p role="alert" className="text-xs text-red-500 mt-1 mb-0 ml-7">
                            {errors.options[o.id]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline-neutral"
                    size="sm"
                    onClick={addOption}
                    disabled={optionCount >= MAX_OPTIONS}
                    className="mt-3 ml-7 w-[calc(100%-5rem)] text-brand"
                  >
                    <img src={AddIcon} alt="" className="w-3.5 h-3.5" />
                    Add Option
                  </Button>

                  <p
                    className={`text-xs mt-2 mb-0 ${errors.optionsSummary ? "text-red-500" : "text-gray-500"}`}
                    role={errors.optionsSummary ? "alert" : undefined}
                  >
                    Use unique labels and values. At least {MIN_OPTIONS} options are required.
                  </p>
                </fieldset>
              </>
            )}

            {/* Default value — shown once a type is chosen */}
            {type && (
              <div className="mb-6">
                <Label htmlFor="custom-col-default">Default Value (Optional)</Label>
                {isDropdown ? (
                  <select
                    id="custom-col-default"
                    value={defaultOptionId}
                    onChange={(e) => setDefaultOptionId(Number(e.target.value) || "")}
                    className={`${inputCls} ${borderOk}`}
                  >
                    <option value="">No default</option>
                    {options
                      .filter((o) => o.label.trim())
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label.trim()}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    id="custom-col-default"
                    type={type === "date" ? "date" : "text"}
                    value={defaultText}
                    onChange={(e) => setDefaultText(e.target.value)}
                    placeholder="Enter a default value for each cell"
                    aria-invalid={!!errors.defaultValue}
                    className={`${inputCls} ${errors.defaultValue ? borderBad : borderOk}`}
                  />
                )}
                <FieldError>{errors.defaultValue}</FieldError>
                <p className="text-xs text-gray-500 mt-1.5 mb-0">
                  Custom values are visible to community admins. Existing rows start empty.
                </p>
              </div>
            )}

            {saveError && (
              <p role="alert" className="text-sm text-red-500 mb-3 mt-0">
                {saveError}
              </p>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm-tight"
                fullWidth={false}
                disabled={saving}
              >
                {saving ? "Adding…" : "Add Column"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
