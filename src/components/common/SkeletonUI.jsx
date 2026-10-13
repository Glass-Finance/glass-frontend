// src/components/common/SkeletonUI.jsx
//
// The pulsing placeholder primitive. Extracted out of
// `pages/dashboard/admin-dashboard/SkeletonUI.jsx`, which kept it under
// `pages/` and so was unreachable from the member app and the rest of the
// dashboard even though the shape is generic — a neutral bar that pulses
// while real content loads.
//
// `ActivityIcon` deliberately stays in its original module: it is an
// admin-dashboard concern (a payment/member/notification glyph keyed off a
// `color` prop), not a generic loading primitive, so moving it here would
// pull a page-specific dependency into the shared layer.
//
// Pure decoration -- a screen-reader user gets nothing useful from a grey
// bar, and the surrounding loading region announces itself (see the
// `aria-busy` on those containers), so this is hidden from the a11y tree.

// `tone` exists because the callers are not all one colour. Skeleton bars
// come in two tones -- a darker one for the primary line, a lighter one for
// the secondary line -- and merging them into a single colour flattens the
// shape. It cannot be overridden by passing a second `bg-*` class in
// `className`: both utilities have identical specificity, so which one wins
// depends on the order Tailwind emits them in the stylesheet, not on the
// order they appear in this string.
export function Skeleton({ className = "", tone = "bg-gray-200" }) {
  return <div aria-hidden="true" className={`${tone} rounded animate-pulse ${className}`} />;
}

export default Skeleton;

// Row-shaped skeleton for a settings list (label + description + toggle).
// Extracted from the two near-identical local copies in
// `pages/dashboard/settings/account/Notifications.jsx` and
// `pages/memberApp/settings/account/Notifications.jsx`, which had drifted on
// padding, bar geometry, colour tokens and -- in the member-app copy -- a
// prohibited raw `#EBEBEB` hex.
//
// The geometry args exist because the two real rows genuinely differ:
// the dashboard row is `py-3` with an `text-xs` label, the member-app row is
// `py-3.5 px-4` with an `text-sm` label. Both take the same shared `Toggle`
// (`components/common/Toggle.jsx`), which is `w-8 h-[20px]`, so the toggle
// placeholder is hardcoded to that footprint rather than parameterised --
// that was one of the drifted bits the copies got wrong.
//
// Decorative throughout: the whole row is hidden from assistive tech, and the
// enclosing section announces the load with `aria-busy`.
export function SkeletonRow({
  last = false,
  pad = "py-3",
  divider = "border-gray-100",
  label = "w-36 h-3 bg-gray-200",
  sub = "w-52 h-2.5 bg-gray-100",
  toggle = "bg-gray-200",
  toggleWidth = "w-8 h-[20px]",
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-between ${pad} ${last ? "" : `border-b ${divider}`}`}
    >
      <div>
        <div className={`rounded-md ${label} mb-1.5 animate-pulse`} />
        <div className={`rounded-md ${sub} animate-pulse`} />
      </div>
      {/* Toggle.jsx's switch is w-8 h-[20px], but that is only the whole
          control when `showLabel` is off. With the label on, the control is
          the switch plus a gap-1.5 and the "On"/"Off" text, so callers pass a
          wider `toggleWidth` — see DASHBOARD_SKELETON_ROW. */}
      <div className={`${toggleWidth} rounded-full flex-shrink-0 ${toggle} animate-pulse`} />
    </div>
  );
}
