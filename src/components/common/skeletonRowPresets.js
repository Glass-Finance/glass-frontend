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
export const MEMBER_APP_SKELETON_ROW = {
  pad: "py-3.5 px-4",
  divider: "border-hairline-soft",
  label: "w-[140px] h-[13px] bg-hairline-soft",
  sub: "w-[200px] h-[11px] bg-hairline-soft",
  toggle: "bg-hairline-soft",
};
