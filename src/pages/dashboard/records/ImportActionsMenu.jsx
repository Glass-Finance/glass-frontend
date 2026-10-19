import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "../../../components/ui/Button";

export default function ImportActionsMenu({ actions, busy, fetching, onRefresh, onAction }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const focusLast = useRef(false);
  const id = useId();
  const items = () => [...root.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
  function close(restore = false) {
    setOpen(false);
    if (restore) trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open) {
      const buttons = items();
      (focusLast.current ? buttons.at(-1) : buttons[0])?.focus();
      focusLast.current = false;
    }
  }, [open]);
  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }
        if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const buttons = items();
          const current = buttons.indexOf(document.activeElement);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (current + (event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
        }
      }}
    >
      <Button
        ref={trigger}
        variant="outline-neutral"
        size="sm-tight"
        fullWidth={false}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (!open && ["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            focusLast.current = event.key === "ArrowUp";
            setOpen(true);
          }
        }}
      >
        Import actions <ChevronDown size={14} aria-hidden="true" />
      </Button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label="Import actions"
          className="absolute right-0 top-full mt-2 z-20 w-56 max-w-[calc(100vw-2rem)] rounded-g-1 border border-surface-container-border bg-white p-1 shadow-sm"
        >
          <Button
            role="menuitem"
            variant="tertiary"
            size="sm-tight"
            className="justify-start"
            disabled={fetching}
            onClick={() => {
              close(true);
              onRefresh();
            }}
          >
            Refresh
          </Button>
          {actions.rerun && (
            <Button
              role="menuitem"
              variant="tertiary"
              size="sm-tight"
              className="justify-start"
              disabled={busy}
              onClick={() => {
                close(true);
                onAction("rerun");
              }}
            >
              Start fresh import
            </Button>
          )}
          {actions.discard && (
            <div className="mt-1 border-t border-surface-container-border pt-1">
              <Button
                role="menuitem"
                variant="tertiary"
                size="sm-tight"
                className="justify-start text-danger"
                disabled={busy}
                onClick={() => {
                  close(true);
                  onAction("discard");
                }}
              >
                Discard import
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
