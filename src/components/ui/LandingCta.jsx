import { forwardRef } from "react";

// DESIGN-SYSTEM.md §2.2b — the landing CTA: the near-white pill the Figma
// landing frames draw for nav/hero/CTA-band/footer CTAs (#fafbfc fill,
// r=60 -> rounded-full, h=50, Inter 500 15px black label). This is NOT
// one of the six product roles in §2.1 and must never be reached for via
// Button variant="primary". Marketing surfaces only.
export const LandingCta = forwardRef(function LandingCta(
  {
    children,
    type = "button",
    onClick,
    disabled,
    loading,
    compact = false,
    className = "",
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center gap-2",
        // Geometry from Figma: every landing CTA instance is h=50 with
        // ~36px horizontal padding and radius 60 (a pill at this height).
        // `compact` is the navbar variant only (owner decision, 2026-10-12):
        // h=50 read as oversized sitting next to the org nav's Sign In pill,
        // which measures 42px. Expressed as a prop rather than a className
        // override so there is exactly one height class in the output —
        // Tailwind does not guarantee cascade order between two arbitrary
        // utilities like h-[50px] and h-[42px].
        compact ? "h-[42px]" : "h-[50px]",
        "px-9 rounded-full",
        // Near-white, not pure white, and black 500/15 label.
        "bg-[#fafbfc] text-black text-[15px] font-medium",
        // Hover/pressed were not measurable via REST; this conservative
        // lift is provisional until the owner rules (§2.2b). Hover-only
        // classes are omitted entirely while disabled so they can't
        // re-enable a lift on an inactive button.
        "transition-[background-color,transform,box-shadow] duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "cursor-pointer",
        isDisabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:bg-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-white/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
});
