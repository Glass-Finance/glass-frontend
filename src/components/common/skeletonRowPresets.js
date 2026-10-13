// Geometry presets for `SkeletonRow` (components/common/SkeletonUI.jsx).
//
// Split out of SkeletonUI.jsx itself because react-refresh
// /only-export-components requires that a file exporting components export
// nothing else -- non-component values go in their own module (same reason
// receiptUtils.js sits next to ReceiptModal.jsx).

// The member-app notification-settings rows (`PrefRow` in
// pages/memberApp/settings/account/Notifications.jsx) differ from the
// dashboard's default skeleton: `py-3.5 px-4` padding, a `text-sm` label,
// and a hairline divider.
//
// Tone: the label and toggle used to carry a raw `bg-[#EBEBEB]`, which
// AGENTS.md bans and which is not a documented value. `bg-gray-200` is the
// closest in-repo match and is already the shared `Skeleton` default, so those
// two bars keep the darker tone they always had. The sub bar stays on
// `bg-hairline-soft` (#f2f2f2, "Hairline surface" in docs/design-system.md).
// Putting all three on one tone would flatten the row, so they stay distinct.
//
// The divider is `border-black/10` rather than `border-hairline-soft`:
// upstream origin/main replaced `border-hairline-soft` with `border-black/10`
// in this very file (on PrefRow, and on the local SkeletonRow copy it
// deleted), so leaving the old token here would make the loading placeholder
// the one row on the screen still using it. This preset has exactly one
// production consumer -- the member-app notifications page -- so changing it
// cannot affect the dashboard settings page, which renders <SkeletonRow />
// with the component defaults (divider `border-gray-100`) and was not part
// of the upstream change.
export const MEMBER_APP_SKELETON_ROW = {
  pad: "py-3.5 px-4",
  divider: "border-black/10",
  label: "w-[140px] h-[13px] bg-gray-200",
  sub: "w-[200px] h-[11px] bg-hairline-soft",
  toggle: "bg-gray-200",
};

// The dashboard notification-settings rows (`NotifRow` in
// pages/dashboard/settings/account/Notifications.jsx) render
// `<Toggle showLabel />`, which draws the w-8 h-[20px] switch plus a gap-1.5
// and the "On"/"Off" text. A bare w-8 placeholder is well under half the real
// control's width and shifts the row when the data lands, so the placeholder is
// widened to match. Everything else is SkeletonRow's default.
export const DASHBOARD_SKELETON_ROW = {
  toggleWidth: "w-14 h-[20px]",
};
