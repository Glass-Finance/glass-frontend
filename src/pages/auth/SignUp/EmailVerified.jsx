import SuccessBadge from "../../../components/common/SuccessBadge";

// "Your Email Has Been Verified!" -- Figma "MacBook Pro 14" - 124" (node
// 1:4224) and its phone twin "iPhone 16 - 56". A full page with no hero
// panel: the success badge and a Headline Small (Inter Medium 24) line,
// centred on the page background with a soft blue glow. SignUp shows it for
// a moment after the code is accepted, then moves on to onboarding.
//
// Phones reuse the auth pages' mobile backdrop; desktop draws the frame's
// glow: a 644px brand-tint disc at (80, 526) under the 120px backdrop blur.
export default function EmailVerified() {
  return (
    <div className="relative min-h-dvh w-full flex items-center justify-center overflow-hidden bg-surface-bg px-6">
      <div className="absolute inset-0 md:hidden bg-cover bg-center bg-no-repeat bg-mobile-auth-default" />
      <div
        aria-hidden="true"
        className="hidden md:block absolute left-[80px] top-[526px] size-[644px] rounded-full bg-brand-100/50 blur-[60px]"
      />
      <div role="status" className="relative">
        <SuccessBadge
          message={
            // -mt-[52px]: Figma sets the line 52px closer to the seal than
            // SuccessBadge's default gap (seal centre to text: 90px). Phones pull
            // 12px less so the line clears the badge's bottom accent dot.
            <span className="block -mt-10 md:-mt-[52px] text-[20px] md:text-[24px] font-medium text-ink">
              Your Email Has Been Verified!
            </span>
          }
        />
      </div>
    </div>
  );
}
