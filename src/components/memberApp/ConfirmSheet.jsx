import { AlertTriangle, X } from "lucide-react";
import { Button } from "../ui/Button";

// Generalized version of the bottom-sheet confirm pattern first built for
// MyCommunities.jsx's LeaveConfirmModal -- a real in-app disclaimer instead
// of the bare OS window.confirm() the member app's destructive actions
// (remove payment method, turn off auto-pay) previously relied on, which is
// easy to blow past without reading and breaks the app's visual flow.
export default function ConfirmSheet({
  icon: Icon = AlertTriangle,
  title,
  description,
  confirmLabel = "Yes, continue",
  confirmingLabel,
  danger = true,
  confirming = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(15,23,42,0.45)]"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] bg-white rounded-t-[20px] pt-6 px-5 pb-7"
      >
        <div className="flex justify-end">
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="Cancel"
            onClick={onCancel}
            className=""
          >
            <X size={18} />
          </Button>
        </div>
        <div className="flex flex-col items-center text-center gap-2.5">
          <div
            className={`w-[52px] h-[52px] rounded-full flex items-center justify-center mb-1 ${danger ? "bg-danger-wash" : "bg-brand-tint"}`}
          >
            <Icon size={24} className={danger ? "text-danger" : "text-brand"} />
          </div>
          <p className="text-[17px] font-bold text-ink m-0">{title}</p>
          <p className="text-[13.5px] text-ink-muted m-0 leading-[1.55] max-w-[320px]">
            {description}
          </p>
        </div>
        <div className="flex flex-col gap-2.5 mt-6">
          {/* Both actions route through ui/Button (docs/design-system.md §2): the
              sheet previously hand-rolled rounded-xl pills at weight 600 with
              no pressed or focus-visible state at all. fullWidth is left at its
              default (true) because these sit stacked in a flex-col and were
              w-full before — ConfirmDialog passes fullWidth={false} because its
              pair shares a row and sizes itself with flex-1 instead. */}
          <Button
            type="button"
            onClick={onConfirm}
            loading={confirming}
            variant={danger ? "critical" : "primary"}
            size="lg"
          >
            {confirming ? (confirmingLabel ?? "Please wait…") : confirmLabel}
          </Button>
          <Button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            variant="outline-neutral"
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
