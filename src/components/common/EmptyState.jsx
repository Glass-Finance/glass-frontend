import { Button } from "../ui/Button";

// Standardized "this list/section has nothing in it yet" state — an icon,
// a clear title, an optional explanatory subtitle, and an optional CTA.
// Replaces the plain one-line gray text ("No X yet.") that used to appear
// inconsistently (no icon, no context, no next step) across the app.
//
// `illustration` (an image src) and `illustrationNode` (an arbitrary React
// node, for illustrations composed of multiple layered pieces) are both
// alternatives to `icon` for the bigger, page-level empty states — existing
// `icon`-based call sites are unaffected.
//
// Page-level (isBig) type per Figma: title 28/500 on 36px leading, subtitle
// 18/400 on 28px — Members `1:8460`. Payments `1:8647` and Notifications
// `1:7532` draw the title at 24/500 instead, so a call site that needs its
// own node's size pins it with `titleClassName`.
const PAGE_TITLE = "text-[28px] leading-9 font-medium text-gray-900";
const PAGE_SUBTITLE = "text-lg font-normal text-gray-400 mt-1.5 max-w-sm";
const COMPACT_TITLE = "text-sm font-semibold text-gray-900";
const COMPACT_SUBTITLE = "text-xs text-gray-400 mt-1 max-w-xs";

export default function EmptyState({
  icon: Icon,
  illustration,
  illustrationNode,
  illustrationClassName,
  title,
  titleClassName,
  subtitle,
  subtitleClassName,
  action,
  actionLabel,
  actionSize,
  className = "",
}) {
  // The bigger page-level states (illustration/illustrationNode) use a
  // larger illustration with a larger, medium-weight title and a tall
  // action button, per Figma -- the small icon-based states used
  // throughout the app for in-page sections keep their original compact
  // size/shape.
  const isBig = !!(illustration || illustrationNode);
  // `actionSize` exists for the handful of full-page states that were built
  // from the compact `icon` layout (Groups) and so wouldn't take the
  // page-level branch above. Compact in-page/filter empties deliberately
  // keep `xs` -- they sit inside a list, not on their own page.
  const btnSize = actionSize || (isBig ? "sm-tight" : "xs");
  const isPageAction = btnSize === "sm-tight";
  return (
    <div className={`flex flex-col items-center text-center py-10 px-6 ${className}`}>
      {illustrationNode && <div className="mb-4">{illustrationNode}</div>}
      {!illustrationNode && illustration && (
        <img
          src={illustration}
          alt=""
          className={illustrationClassName || "w-[240px] h-auto mb-4"}
          draggable={false}
        />
      )}
      {!illustrationNode && !illustration && Icon && (
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-brand-tint">
          <Icon size={20} className="text-brand" />
        </div>
      )}
      <p className={titleClassName || (isBig ? PAGE_TITLE : COMPACT_TITLE)}>{title}</p>
      {subtitle && (
        <p className={subtitleClassName || (isBig ? PAGE_SUBTITLE : COMPACT_SUBTITLE)}>
          {subtitle}
        </p>
      )}
      {action && (
        <Button
          onClick={action}
          fullWidth={false}
          size={btnSize}
          className={isPageAction ? "mt-6 px-5" : "mt-4"}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
