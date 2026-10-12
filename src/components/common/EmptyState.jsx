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
  // larger illustration with a larger, regular-weight title and a tall
  // action button, per Figma -- the small icon-based states used
  // throughout the app for in-page sections keep their original compact
  // size/shape.
  const isBig = !!(illustration || illustrationNode);
  // `actionSize` exists for the handful of full-page states that were built
  // from the compact `icon` layout (Groups) and so wouldn't take the
  // page-level branch above. Compact in-page/filter empties deliberately
  // keep `xs` -- they sit inside a list, not on their own page.
  const btnSize = actionSize || (isBig ? "lg-tight" : "xs");
  const isPageAction = btnSize === "lg-tight";
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
      <p
        className={
          titleClassName ||
          (isBig
            ? "text-xl leading-7 font-normal text-gray-900"
            : "text-sm font-semibold text-gray-900")
        }
      >
        {title}
      </p>
      {subtitle && (
        <p
          className={
            subtitleClassName ||
            (isBig
              ? "text-base text-gray-400 mt-1.5 max-w-sm"
              : "text-xs text-gray-400 mt-1 max-w-xs")
          }
        >
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
