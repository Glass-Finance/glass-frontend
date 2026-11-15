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

// `wide` is the desktop Sign Up verification frame (Figma "Verification Code
// Sent", node 252:16554): from md up the row spans its column -- each group of
// three spread edge to edge, 48px either side of a 20px dash (xl+) -- with 4px
// corners and a 1px border. Boxes are fluid squares capped at Figma's 64px, so
// a narrower column (tablets, small laptops) shrinks them instead of
// overflowing; `!` because the default md:w-16/md:h-16 sit on the same
// element. Below md it is byte-for-byte the default boxes.
const WIDE = {
  row: "md:w-full md:gap-4 xl:gap-12",
  group: "md:flex-1 md:min-w-0 md:justify-between md:gap-2!",
  box: "md:rounded-g-1 md:border md:w-auto! md:h-auto! md:flex-1 md:min-w-0 md:max-w-16 md:aspect-square",
  dash: "md:w-5 md:h-px md:bg-black md:text-[0px]",
};

function renderBoxes(boxDigits, activeIndex, wide) {
  const w = wide ? WIDE : { row: "", group: "", box: "", dash: "" };
  const box = (d, idx) => (
    <div
      key={idx}
      aria-label={`Digit ${idx + 1} of ${OTP_LENGTH}`}
      className={`w-9 h-9 sm:w-10 sm:h-10 md:w-16 md:h-16 flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-gray-900 transition-all duration-150 text-[16px] md:text-xl md:text-[22px] border-[1.5px] ${idx === activeIndex ? "otp-box-active " : ""}${d || idx === activeIndex ? "border-brand-deep" : "border-hairline-strong"}${w.box ? ` ${w.box}` : ""}`}
    >
      {d}
    </div>
  );
  return (
    <div
      className={`mx-auto flex w-fit max-w-full items-center justify-center gap-1 pointer-events-none${w.row ? ` ${w.row}` : ""}`}
    >
      <div className={`flex items-center gap-2 md:gap-4${w.group ? ` ${w.group}` : ""}`}>
        {boxDigits.slice(0, 3).map((d, i) => box(d, i))}
      </div>
      <span
        className={`text-gray-400 text-base md:text-xl font-light flex-shrink-0${w.dash ? ` ${w.dash}` : ""}`}
      >
        —
      </span>
      <div className={`flex items-center gap-2 md:gap-4${w.group ? ` ${w.group}` : ""}`}>
        {boxDigits.slice(3, 6).map((d, i) => box(d, i + 3))}
      </div>
    </div>
  );
}

export function renderDashedOtpBoxes(boxDigits, activeIndex) {
  return renderBoxes(boxDigits, activeIndex, false);
}

export function renderWideDashedOtpBoxes(boxDigits, activeIndex) {
  return renderBoxes(boxDigits, activeIndex, true);
}

export default renderDashedOtpBoxes;
