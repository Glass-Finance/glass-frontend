import { forwardRef } from "react";

// Figma "Mobile Back Button" (node 1:14109), the circular back affordance
// that sits in the header of every member-app screen. Geometry straight from
// the file: 48x48, cornerRadius 999 (a true circle), fill #ffffff @ 0.6,
// stroke #000000 @ 0.1 at 1px, with the 24px "Icon/Back" glyph (node
// 82:14693) centred inside it in #000000.
//
// This is a *mobile* component. The dashboard's back affordances are text
// buttons in the breadcrumb and do not use it.
//
// Radius 999 here is the fourth `rounded-full` exception recorded in
// DESIGN-SYSTEM.md §1.5 alongside toggle tracks, badges and landing CTAs --
// Figma draws the circle deliberately, so it is not a violation of the 4px
// rule in §2.1.

// Icon/Back (82:14693), reproduced exactly: a single chevron path at
// stroke-width 1.5 (not lucide's 2), coloured by the parent so the glyph
// follows the button's text colour.
function BackGlyph() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15.0312 5.98926L9.01034 12.0102L15.0312 18.0311" />
    </svg>
  );
}

export const MobileBackButton = forwardRef(function MobileBackButton(
  { onClick, className = "", "aria-label": ariaLabel = "Back", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      // Surface-container is the file's #ffffff @ 0.6 glass fill; the 1px
      // #000000 @ 0.1 stroke is border-black/10. Hover/active darken the
      // glass the same way the button roles do (DESIGN-SYSTEM.md §2.3).
      className={[
        "inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full",
        "bg-surface-container border border-black/10 text-ink cursor-pointer",
        "transition-colors duration-150",
        "hover:bg-white/75 active:bg-white/90",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <BackGlyph />
    </button>
  );
});

MobileBackButton.displayName = "MobileBackButton";
