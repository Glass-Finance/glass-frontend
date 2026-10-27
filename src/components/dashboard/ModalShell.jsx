import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/Button";

// Shared dashboard modal chrome — extracted out of PlatformAdmin.jsx so other
// dashboard pages (Members, MemberDetail, MemberAccess, Payments, finance
// settings) can build confirm dialogs on the same visual language instead
// of falling back to window.confirm(). Also used by EmailChangeModal and
// PhoneChangeModal (SignUp and the member app) -- both of those sit outside
// the dashboard's KeyboardShortcutsProvider, so this keeps its own
// self-contained Escape handling rather than going through
// useEscapeToClose, which would silently no-op there.
//
// title is optional: EmailChangeModal/PhoneChangeModal put their own
// heading inside their content (a bigger, differently-styled title than a
// dashboard confirm dialog's), so when title is omitted the bordered
// header row + divider aren't rendered at all -- only the close button,
// positioned over the content instead of inside a header strip.
//
// footer (optional): a fixed action bar rendered below the children and
// outside whatever scroll region the caller sets on its body — the modal
// UX rule is that the primary action must never be scrolled to reach, so
// decision buttons/reason forms belong here, not at the end of a long
// scrollable body.
// Close-button styling, shared by both variants below so they can't drift.
// Icon-only close buttons now route through ui/Button's icon-sm size
// (docs/design-system.md §2.2a adds the icon-only sizes; §6.7 resolved). The
// tertiary role is the transparent, borderless treatment; aria-label is
// mandatory because Button does not add one.
const CLOSE_BTN = "flex-shrink-0";

export default function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "default",
  className = "",
}) {
  // Escape-to-close -- every dashboard modal built on this shell gets this
  // for free; hand-rolled modals elsewhere in the app don't have it yet.
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/20"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative bg-surface-bg rounded-2xl w-full shadow-2xl border border-surface-container-border ${size === "wide" ? "max-w-3xl" : title ? "max-w-md" : "max-w-xl"} ${title ? "" : "px-6 py-8"} ${className}`}
      >
        {title ? (
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-bold text-gray-900">{title}</h2>
              {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
            <Button
              variant="tertiary"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close"
              className={CLOSE_BTN}
            >
              <X size={15} />
            </Button>
          </div>
        ) : (
          <Button
            variant="tertiary"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
            className={`absolute top-4 right-4 ${CLOSE_BTN}`}
          >
            <X size={15} />
          </Button>
        )}
        {children}
        {footer && <div className="border-t border-gray-100 px-6 pt-4 pb-5">{footer}</div>}
      </div>
    </div>
  );
}
