// Geometry presets for `SkeletonRow` (components/common/SkeletonUI.jsx).
//
// Split out of SkeletonUI.jsx itself because react-refresh
// /only-export-components requires that a file exporting components export
// nothing else -- non-component values go in their own module (same reason
// receiptUtils.js sits next to ReceiptModal.jsx).

// The member-app notification-settings rows (`PrefRow` in
// pages/memberApp/settings/account/Notifications.jsx) differ from the
// dashboard's default skeleton: `py-3.5 px-4` padding, a `text-sm` label,
// and a hairline divider. The colour `#f2f2f2` (bg-hairline-soft) is the
// approved design-system replacement for the raw `bg-[#EBEBEB]` this row
// used to carry.
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
  label: "w-[140px] h-[13px] bg-hairline-soft",
  sub: "w-[200px] h-[11px] bg-hairline-soft",
  toggle: "bg-hairline-soft",
};
