// Shared dashed OTP box renderer — a render PROP, not a component.
//
// Passed to <OtpBoxes renderBoxes={...} />, which invokes it as
// renderBoxes(digits, activeIndex) to draw the boxes over its single hidden
// <input>. It must therefore stay a plain function returning JSX.
//
// This used to live in src/pages/auth/member/Join/otpBoxes.jsx. It moved out
// when the OTP input itself was unified (see OtpBoxes.jsx) so every surface —
// member join, sign-in, forgot-password, and the member-app settings phone /
// email flows — could render one box style. It is a standalone module on
// purpose: a file that mixes a plain render-prop function with exported
// components breaks Fast Refresh (react-refresh/only-export-components),
// which is why the component and this renderer are not co-located.
//
// Box size follows Figma at md+ (64×64); compact modal layouts use 36×36 on
// phones and 40×40 from sm, keeping all six boxes inside narrow dialogs.
// The active box changes its border color while the hidden input is focused.
const OTP_LENGTH = 6;

export function renderDashedOtpBoxes(boxDigits, activeIndex) {
  return (
    <div className="mx-auto flex w-fit max-w-full items-center justify-center gap-1 pointer-events-none">
      <div className="flex items-center gap-2">
        {boxDigits.slice(0, 3).map((d, i) => (
          <div
            key={i}
            aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
            className={`w-9 h-9 sm:w-10 sm:h-10 md:w-16 md:h-16 flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-gray-900 transition-all duration-150 text-[16px] md:text-xl md:text-[22px] border-[1.5px] ${i === activeIndex ? "otp-box-active " : ""}${d || i === activeIndex ? "border-brand-deep" : "border-hairline-strong"}`}
          >
            {d}
          </div>
        ))}
      </div>
      <span className="text-gray-400 text-base md:text-xl font-light flex-shrink-0">—</span>
      <div className="flex items-center gap-2">
        {boxDigits.slice(3, 6).map((d, i) => {
          const idx = i + 3;
          return (
            <div
              key={idx}
              aria-label={`Digit ${idx + 1} of ${OTP_LENGTH}`}
              className={`w-9 h-9 sm:w-10 sm:h-10 md:w-16 md:h-16 flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-gray-900 transition-all duration-150 text-[16px] md:text-xl md:text-[22px] border-[1.5px] ${idx === activeIndex ? "otp-box-active " : ""}${d || idx === activeIndex ? "border-brand-deep" : "border-hairline-strong"}`}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default renderDashedOtpBoxes;
