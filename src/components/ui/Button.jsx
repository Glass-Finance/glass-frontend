import { forwardRef } from "react";

// Implements the six button roles and six sizes in DESIGN-SYSTEM.md §2,
// extracted from the Figma file "Glass Design By AQ". Read that section
// before changing anything here -- it records the exact padding, height,
// label size, radius and state values, and which hex values are banned.
//
// 406 call sites use this component. Anything you add needs a reason that
// isn't "the old one was easier".

// Legacy aliases for the three roles this component shipped before
// DESIGN-SYSTEM.md. "brand" was the old primary, "danger" the old critical,
// "secondary" a *filled* grey pill that Figma does not define -- it now maps
// to the outline role, which is what those call sites were reaching for (they
// were all Cancel buttons).
const LEGACY_VARIANTS = {
  brand: "primary",
  danger: "critical",
  secondary: "outline",
};

// Figma padding is given as T/R/B/L and produces these exact heights with
// the label sizes below. Height classes keep them locked together: editing
// one means editing the other.
const SIZES = {
  //       py       px      height label
  xs: { pad: "py-2", px: "px-3", h: "h-8", text: "text-[12px]" }, // X-s 8/12/8/12  h32
  sm: { pad: "py-2", px: "px-4", h: "h-10", text: "text-[14px]" }, // S   8/16/8/16  h40
  md: { pad: "py-3", px: "px-6", h: "h-12", text: "text-[14px]" }, // M  12/24/12/24 h48
  lg: { pad: "py-4", px: "px-8", h: "h-14", text: "text-[16px]" }, // L  16/32/16/32 h56
  xl: { pad: "py-5", px: "px-10", h: "h-16", text: "text-[16px]" }, // XL 20/40/20/40 h64
  // Owner-directed exception. Figma pairs h40 with a 14px label; sm-tight
  // keeps the box and drops the label to 12px, so long header and
  // empty-state labels stop crowding the button edge. Padding and height
  // are byte-for-byte `sm` -- only `text` differs.
  // Added 2026-10-12 with the dashboard button-sizing sweep; documented in
  // DESIGN-SYSTEM.md §2.2d as a decoupling rather than a new Figma size.
  "sm-tight": { pad: "py-2", px: "px-4", h: "h-10", text: "text-[12px]" }, // h40 12px
  // Icon-only: square, no horizontal padding, because there is no label to
  // clear. Hit areas are the squares the Figma file actually draws (24/32/40
  // were all present; 48 is carried over from the button scale because 40 is
  // below the 44px touch-target guidance on phones). No text size -- the
  // child is an icon, and inlining a label into one of these would defeat
  // the point of the role. Pair with aria-label; Button does not add one.
  "icon-sm": { pad: "", px: "", h: "h-8 w-8", text: "" }, // 32
  "icon-md": { pad: "", px: "", h: "h-10 w-10", text: "" }, // 40
  "icon-lg": { pad: "", px: "", h: "h-12 w-12", text: "" }, // 48
};

// Six roles. Outline is three colour roles of one component (Figma's
// Secondary/Outline, Outline Secondary Button and Outline Caution Button
// are geometrically identical sets differing only in label colour), hence
// three entries instead of one.
//
// Hover/Pressed are black overlays on the fill (DESIGN-SYSTEM.md §2.3), so
// they are precomputed hexes (#002f9b / #002b8f for brand, #c20000 /
// #ad0000 for critical) rather than element opacity: hover:opacity-90 also
// fades the label and reads as black @10%, which is neither. Disabled keeps
// the fill per spec and is dimmed by opacity only because Figma gives no
// separate disabled colour.
const VARIANTS = {
  primary: {
    on: "bg-brand text-white hover:bg-brand-hover active:bg-brand-pressed",
    off: "bg-brand text-white opacity-60",
  },
  critical: {
    on: "bg-danger text-white hover:bg-[#c20000] active:bg-[#ad0000]",
    off: "bg-danger text-white opacity-60",
  },
  // Success and Warning are NOT in the Figma file -- it defines no such
  // button role. Added on instruction, using the fills the file itself
  // reaches for elsewhere (success #008000 at 435 nodes, warning #9a6500 at
  // 91), so they are consistent with the design rather than invented. Marked
  // in DESIGN-SYSTEM.md §2 as an extension, not as spec.
  success: {
    on: "bg-success text-white hover:bg-[#007300] active:bg-[#006600]",
    off: "bg-success text-white opacity-60",
  },
  warning: {
    on: "bg-warning text-white hover:bg-[#8a5a00] active:bg-[#7a4f00]",
    off: "bg-warning text-white opacity-60",
  },
  outline: {
    on: "bg-transparent text-brand border border-black/10 hover:bg-black/5 active:bg-black/10",
    off: "bg-transparent text-brand border border-black/10 opacity-60",
  },
  "outline-neutral": {
    on: "bg-transparent text-black border border-black/10 hover:bg-black/5 active:bg-black/10",
    off: "bg-transparent text-black border border-black/10 opacity-60",
  },
  "outline-caution": {
    on: "bg-transparent text-danger border border-black/10 hover:bg-black/5 active:bg-black/10",
    off: "bg-transparent text-danger border border-black/10 opacity-60",
  },
  tonal: {
    on: "bg-white/60 text-brand border border-black/10 hover:bg-white/75 active:bg-white/90",
    off: "bg-white/60 text-brand border border-black/10 opacity-60",
  },
  // Tertiary is the muted text-link role. Figma defines it as two variants in
  // component set 1:11927: a brand-blue default and a "Subtle" one at
  // #000000 @60%. The blue default is library-only -- every tertiary the file
  // actually places on a page ("Back", "See All", breadcrumbs) is Subtle, so
  // that is what this role renders. The previous text-brand here leaked blue
  // into every back link, See-All link and breadcrumb in the app.
  tertiary: {
    on: "bg-transparent text-black/60 hover:bg-black/5 active:bg-black/10",
    off: "bg-transparent text-black/60 opacity-60",
  },
};

const SIZES_KEYS = Object.keys(SIZES);
const VARIANTS_KEYS = Object.keys(VARIANTS);

export const Button = forwardRef(function Button(
  {
    children,
    type = "button",
    onClick,
    disabled,
    loading,
    fullWidth = true,
    // Old default behaviour: `py-4` + `text-button` = 56px tall, 14px
    // label. The spec's Large is 56px with a 16px label / 32px sides, so
    // the default keeps the 56px height those call sites were sized for.
    size = "lg",
    variant = "primary",
    className = "",
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  const resolvedVariant = LEGACY_VARIANTS[variant] ?? variant;
  const spec = VARIANTS[resolvedVariant] ?? VARIANTS.primary;
  const sizeSpec = SIZES[size] ?? SIZES.md;
  // Icon sizes are square; w-full would stretch them into an ellipse.
  const isIconSize = size.startsWith("icon-");

  const classes = [
    fullWidth && !isIconSize ? "w-full" : "",
    // 4px radius at every state -- DESIGN-SYSTEM.md §2.1. Figma conflicts
    // with itself on the hover radius of some variants; the smaller value
    // wins, so there is no state-dependent radius swap. rounded-g-1 is the
    // Figma-derived token, not Tailwind's rounded-lg (8px).
    "rounded-g-1",
    // Figma draws every button as a horizontal auto-layout with 8px between
    // the icon and the label, both axes centred (itemSpacing: 8,
    // primaryAxis/counterAxisAlignItems: CENTER, content HUG). Without this
    // the children stack as bare inline nodes and an icon+label pair sits
    // baseline-aligned with a sub-4px gap. Call sites no longer need their
    // own `flex items-center gap-*`; see DESIGN-SYSTEM.md §2.2.
    "inline-flex items-center justify-center gap-2",
    sizeSpec.pad,
    sizeSpec.px,
    sizeSpec.h,
    sizeSpec.text,
    "font-medium",
    "cursor-pointer",
    "transition-colors duration-150",
    // Focused state is a #0f53ff outline (DESIGN-SYSTEM.md §2.3), driven
    // by the same token the global :focus-visible rule now uses.
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    isDisabled ? "cursor-not-allowed" : "",
    isDisabled ? spec.off : spec.on,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {children}
    </button>
  );
});

Button.displayName = "Button";

export const BUTTON_SIZES = SIZES_KEYS;
export const BUTTON_VARIANTS = VARIANTS_KEYS;
