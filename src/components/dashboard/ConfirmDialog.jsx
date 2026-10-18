import { Loader2 } from "lucide-react";
import ModalShell from "./ModalShell";
import { Button } from "../ui/Button";

// Generic branded confirm dialog for dashboard destructive/state-changing
// actions (remove member, promote/demote, remove payment method, turn off
// auto-pay, etc.) -- replaces the raw window.confirm() these previously
// used, which reads as a system warning rather than part of the product
// and is easy to blow past without reading.
export default function ConfirmDialog({
  title,
  subtitle,
  description,
  children,
  confirmLabel = "Confirm",
  confirmingLabel,
  danger = true,
  confirming = false,
  confirmDisabled = false,
  error = "",
  onConfirm,
  onClose,
}) {
  return (
    <ModalShell title={title} subtitle={subtitle} onClose={onClose}>
      <div className="px-6 py-5 flex flex-col gap-4">
        {description && <p className="text-xs text-gray-600 leading-relaxed">{description}</p>}
        {/* Optional extra content (e.g. a reason field) between the
            description and the buttons; callers that don't need it pass
            nothing and render exactly as before. */}
        {children}
        {/* Rejection surfaced by onConfirm's onError (e.g. a reactive KYC
            block) — renders inside the dialog so the reason lands where the
            user just clicked, and the dialog stays open to retry. */}
        {error && (
          <p className="text-xs leading-relaxed bg-danger-wash text-danger rounded-xl px-3 py-2.5 -mt-1">
            {error}
          </p>
        )}
        <div className="flex gap-3 pt-1">
          {/* Both actions go through ui/Button, so the destructive path gets
              the same radius, weight and five states as the benign one. The
              Cancel button used to be a filled grey pill (rounded-xl,
              bg-gray-100, font-semibold) — the role collapse DESIGN-SYSTEM.md
              §4.3 calls out. It's the outline-neutral role now. */}
          <Button
            type="button"
            onClick={onClose}
            disabled={confirming}
            fullWidth={false}
            variant="outline-neutral"
            size="sm"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            loading={confirming}
            disabled={confirmDisabled}
            fullWidth={false}
            variant={danger ? "critical" : "primary"}
            size="sm"
            className="flex-1"
          >
            {confirming && <Loader2 size={12} className="animate-spin" />}
            {confirming ? (confirmingLabel ?? "Please wait…") : confirmLabel}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
