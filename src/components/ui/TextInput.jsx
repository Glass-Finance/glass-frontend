import { forwardRef, useId } from "react";

// #002FA7 is the one active-state color for every input in the app (per
// Figma) -- a stroke-only change, deliberately no background fill, since a
// filled active state reads as a button rather than a field. Resting
// border color is still allowed to vary a little per flow (literal class
// strings, not template-interpolated, so Tailwind's scanner picks them up).
const VARIANTS = {
  // Glass/OutlineVariant per Figma dev-mode spec (#797D86 @ 40%) -- #E0E0E6
  // was too close to the page background to read as a stroke at all.
  default: "border-outline-input/40 focus:border-brand",
  signup: "border-hairline-disabled focus:border-brand",
};

// Default form-label styling, matching the label the app's forms were
// already writing by hand ("block text-xs font-medium text-gray-700 mb-1.5").
// A call site that wants a different label style passes `labelClassName`.
const DEFAULT_LABEL_CLASS = "block text-xs font-medium text-gray-700 mb-1.5";

// Single source of truth for the app's text/email/password/number inputs —
// per Figma, every input across every screen (desktop and mobile) shares
// the same height, radius, border, and padding; only width is allowed to
// differ per screen, which is why width isn't baked in here (parents size
// this via their own layout, w-full by default). Before this existed,
// nearly every page rolled its own `inputCls` string, so radius alone
// ranged from 2px to 12px across the app with no two pages agreeing on
// height or padding either.
//
// Accessible name: this component owns it. `label` renders a real
// <label htmlFor> bound to the field, so the association cannot be dropped
// by a caller the way a hand-written sibling <label> can be. `hideLabel`
// keeps that label in the accessibility tree while hiding it visually, for
// fields whose visible name is already carried by a placeholder.
//
// The generated fallback id is sanitised: React's useId() returns something
// like ":r0:" / "«r0»", and a colon is legal in an id but breaks every CSS
// `#id` selector and querySelector call against it. Stripping to
// [A-Za-z0-9_-] keeps the id unique per instance and selector-safe.
//
// The label is rendered as a SIBLING of the relative wrapper, not inside it.
// The wrapper positions `rightElement` (the show/hide-password button) with
// `absolute top-1/2 -translate-y-1/2`; a label inside that div would make it
// taller and re-centre that button on the label+input block instead of on the
// input. Keeping the label outside leaves the wrapper's geometry untouched.
export const TextInput = forwardRef(function TextInput(
  {
    id,
    label,
    labelClassName = DEFAULT_LABEL_CLASS,
    hideLabel = false,
    errorId,
    type = "text",
    placeholder,
    value,
    onChange,
    onBlur,
    onKeyDown,
    onFocus,
    autoComplete,
    inputMode,
    disabled,
    rightElement,
    error,
    maxLength,
    variant = "default",
    className = "",
    ...rest
  },
  ref,
) {
  const generatedId = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const inputId = id ?? generatedId;
  const invalid = Boolean(error);
  // Point the field at its error text when the caller tells us where that
  // text lives, so the message is announced with the field instead of only
  // appearing visually.
  const describedBy = invalid && errorId ? errorId : undefined;
  return (
    <>
      {label ? (
        <label htmlFor={inputId} className={hideLabel ? "sr-only" : labelClassName}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-describedby={describedBy}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          autoComplete={autoComplete}
          inputMode={inputMode}
          disabled={disabled}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          // Pinned to text-base (16px/24px) rather than the text-placeholder
          // token -- that token is being sized down for the dashboard/onboarding
          // inputs, but auth's fields were already tuned separately and stay put.
          className={`w-full rounded-g-1 border px-4 py-3.5 text-base text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${invalid ? "border-danger focus:border-brand" : VARIANTS[variant]} ${className}`}
          {...rest}
        />
        {rightElement && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
    </>
  );
});
