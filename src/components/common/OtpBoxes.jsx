import { useEffect, useRef } from "react";

// Shared OTP input. Renders as a row of visual boxes, but underneath there
// is exactly ONE real, focusable <input> — invisible, stretched over the
// whole row — that receives every keystroke, paste, and autofill event.
// The boxes themselves are plain <div>s, not inputs.
//
// This replaces an earlier version with one real <input> PER digit, which
// tried to fix iOS's "keyboard closes itself" bug by deferring cross-box
// .focus() calls with setTimeout(...,0). That didn't hold up on real
// iPhones: when the QuickType/SMS-autofill bar inserts a code, WebKit has
// to redistribute characters across sibling inputs and shift focus between
// them — and any focus-juggling in response to that autofill event is
// unreliable on iOS regardless of the delay, not just at 0ms. With a single
// real input, there is no cross-box focus-shifting to go wrong: typing,
// backspacing, and autofill all use completely ordinary single-input
// semantics that iOS already handles correctly.
//
// Making that one real input actually invisible turned out to have its own
// footguns, both addressed below:
//   - `opacity: 0` risks Safari's autofill-suggestion heuristic treating the
//     field as not meaningfully visible and skipping the QuickType/SMS-code
//     suggestion entirely. Using `opacity: 1` with transparent color/
//     background/caret instead keeps the element "visible" to the browser's
//     own logic while still showing nothing to the human eye.
//   - WebKit applies its own `:-webkit-autofill` internal style (the
//     familiar yellow-tinted background) the moment a field is autofilled,
//     which overrides plain `color`/`background` CSS via user-agent
//     stylesheet specificity — exactly the moment this input matters most.
//     Left unhandled, the "invisible" input could flash visible right when
//     autofill fires. Defeated below with the standard -webkit-text-fill-
//     color + frozen-transition trick.
const AUTOFILL_OVERRIDE_CSS = `
.otp-hidden-input:-webkit-autofill,
.otp-hidden-input:-webkit-autofill:hover,
.otp-hidden-input:-webkit-autofill:focus {
  -webkit-text-fill-color: transparent !important;
  transition: background-color 9999s ease-in-out 0s;
  box-shadow: 0 0 0px 1000px transparent inset !important;
}
`;

export default function OtpBoxes({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  onKeyDown,
  renderBoxes,
  className = "",
}) {
  const inputRef = useRef(null);
  const code = value.join("").slice(0, length);
  // The box the caret would logically be in — the next empty one, or the
  // last box once the code is complete.
  const activeIndex = Math.min(code.length, length - 1);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, length);
    const next = Array(length).fill("");
    digits.split("").forEach((ch, i) => {
      next[i] = ch;
    });
    onChange(next);
  }

  const digits = Array.from({ length }, (_, i) => code[i] ?? "");

  return (
    <div
      className={`relative otp-input-root ${className}`}
      onClick={() => !disabled && inputRef.current?.focus()}
    >
      <style>{AUTOFILL_OVERRIDE_CSS}</style>
      <input
        ref={inputRef}
        name="otp"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={length}
        autoComplete="one-time-code"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        value={code}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-label="Verification code"
        // Kept opacity: 1 deliberately — see comment above the component.
        // Every visual trace is erased via transparent color/caret instead,
        // so Safari's own visibility heuristics still see a real, "visible"
        // field. text-base (16px) is deliberate too: below that, iOS
        // auto-zooms the page on focus based on the input's computed font
        // size, even though the input itself is invisible.
        className="otp-hidden-input absolute inset-0 w-full h-full z-[1] m-0 p-0 border-none outline-none bg-transparent text-transparent caret-transparent [-webkit-text-fill-color:transparent] text-base"
      />
      {renderBoxes ? (
        renderBoxes(digits, activeIndex)
      ) : (
        <div className="flex items-center gap-4 justify-center pointer-events-none">
          {digits.map((d, i) => (
            <div
              key={i}
              className={`w-16 h-16 flex-shrink-0 flex items-center justify-center text-lg font-semibold text-gray-900 rounded-lg border-[1.5px] transition-all ${i === activeIndex ? "otp-box-active " : ""}${d || i === activeIndex ? "border-brand-deep" : "border-hairline-neutral"}`}
            >
              {d}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
