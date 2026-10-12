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

export function Skeleton({ className = "" }) {
  return <div aria-hidden="true" className={`bg-gray-200 rounded animate-pulse ${className}`} />;
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
      {/* Must match Toggle.jsx's own w-8 h-[20px] -- a placeholder wider or
          taller than the switch it stands in for shifts the row on swap. */}
      <div className={`w-8 h-[20px] rounded-full flex-shrink-0 ${toggle} animate-pulse`} />
    </div>
  );
}
