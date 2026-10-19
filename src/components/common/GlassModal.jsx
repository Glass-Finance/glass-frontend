import { useEffect, useRef } from "react";
import { Button } from "../ui/Button";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Shared modal primitive encoding Glass's general modal UX rules:
//   - Fixed header + fixed footer around an optional scroll body, so the
//     primary action (footer) is never scrolled off. If content needs a
//     lot of room, use a drawer/page instead of growing this.
//   - Exactly one footer slot: callers put one primary + one secondary
//     action there — no modal-as-miniature-page action sprawl.
//   - Self-contained a11y: portals to <body>, role="dialog" + aria-modal,
//     focus trap + restore, Escape-to-close, body scroll lock. Escape and
//     backdrop-click can be suspended while a critical sub-flow is open
//     (closeDisabled) so a half-finished capture isn't orphaned.
//   - Geometry: bottom sheet on mobile (matching the app's sheet pattern),
//     centered card from sm: up.
//
// Unlike ModalShell (dashboard-only chrome), this has no title requirement
// and exposes headerExtra/footer slots for wizard-style bodies — the KYC
// wizard is the first consumer; other modals can migrate onto it.
export default function GlassModal({
  open = true,
  appearance = "default",
  onClose,
  label,
  title,
  subtitle,
  headerExtra,
  headerClassName = "",
  showClose = true,
  closeDisabled = false,
  className = "",
  bodyClassName = "",
  children,
  footer,
}) {
  const panelRef = useRef(null);
  const lastActiveRef = useRef(null);

  // Focus + scroll lock on open; restore both on close.
  useEffect(() => {
    if (!open) return undefined;
    lastActiveRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      const prev = lastActiveRef.current;
      if (prev && typeof prev.focus === "function" && document.contains(prev)) prev.focus();
    };
  }, [open]);

  // Escape-to-close + focus trap. Registered on window (like ModalShell) so
  // it works outside KeyboardShortcutsProvider; skipList for other modals'
  // Escape listeners is unnecessary — a modal stack shouldn't exist (see the
  // "inline confirmation over stacked modals" rule).
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (!closeDisabled) {
          e.preventDefault();
          onClose?.();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(
        panel.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (document.activeElement === panel || !panel.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeDisabled, onClose]);

  if (!open) return null;

  const onBackdropClick = (e) => {
    if (e.target !== e.currentTarget) return;
    if (!closeDisabled) onClose?.();
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-4 ${appearance === "dashboard" ? "bg-black/20" : "bg-[rgba(15,23,42,0.45)]"}`}
      onClick={onBackdropClick}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        className={`relative outline-none w-full ${appearance === "dashboard" ? "bg-white rounded-t-g-3 sm:rounded-g-3" : "bg-white rounded-t-[20px] sm:rounded-2xl"} border border-surface-container-border shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[88vh] ${className}`}
      >
        {(title || showClose) && (
          <div className={`flex-shrink-0 relative ${headerClassName}`}>
            <div className="flex items-start justify-between gap-3 px-5 pt-4 sm:px-6">
              <div className="min-w-0">
                {title && (
                  <h2 className="text-[15.5px] font-bold text-ink m-0 leading-snug">{title}</h2>
                )}
                {subtitle && <p className="text-xs text-ink-muted mt-0.5 mb-0">{subtitle}</p>}
              </div>
              {showClose && !closeDisabled && (
                <Button
                  variant="tertiary"
                  size="icon-sm"
                  aria-label="Close"
                  onClick={() => onClose?.()}
                  className="-mr-1 flex-shrink-0"
                >
                  <X size={18} />
                </Button>
              )}
            </div>
            {headerExtra}
          </div>
        )}
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-neutral px-5 py-4 sm:px-6 ${bodyClassName}`}
        >
          {children}
        </div>
        {footer && (
          <div
            className={`flex-shrink-0 border-t border-surface-container-border px-5 py-4 sm:px-6 ${appearance === "dashboard" ? "bg-white" : "bg-white/85 backdrop-blur-xl"}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
