import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { createPortal } from "react-dom";
import { X, FileText, Image as ImageIcon, Share2 } from "lucide-react";
import { notifyError } from "../../utils/errorHandler";
import ReceiptCard from "./ReceiptCard";

// ── Modal (bottom sheet) ──────────────────────────────────────────────────────

export default function ReceiptModal({ tx, payerName, payerEmail, onClose }) {
  const cardRef = useRef(null);
  const qrRenderRef = useRef({ ready: false, resolve: null, reject: null, error: null });
  const [saving, setSaving] = useState(null); // "image" | "pdf" | "share" | null

  // Not routed through useEscapeToClose/KeyboardShortcutsProvider -- this
  // modal is shared with the member app (PaymentSuccess, TransactionDetail),
  // which sits outside the dashboard's shortcut provider entirely. Keeping
  // its own handler so Escape still works there.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onQrReady() {
    qrRenderRef.current.ready = true;
    qrRenderRef.current.resolve?.();
  }

  function onQrError(error) {
    qrRenderRef.current.error = error;
    qrRenderRef.current.reject?.(error);
  }

  async function captureCard(scale = 3) {
    if (!cardRef.current) return null;
    if (tx?.reference ?? tx?.id) {
      if (qrRenderRef.current.error) throw qrRenderRef.current.error;
      if (!qrRenderRef.current.ready) {
        await new Promise((resolve, reject) => {
          qrRenderRef.current.resolve = resolve;
          qrRenderRef.current.reject = reject;
        });
      }
    }
    // Dynamically imported rather than at module scope, matching the jspdf
    // pattern in generateReceipt.js: html2canvas is ~200 kB and only needed
    // when the member actually taps Save Image or Share — not on every render
    // of the receipt modal.
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(cardRef.current, {
      scale,
      backgroundColor: "#FFFFFF",
      useCORS: true,
      logging: false,
    });
  }

  async function handleSaveImage() {
    if (saving) return;
    setSaving("image");
    try {
      const canvas = await captureCard(3);
      if (!canvas) return;
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      // Date.now() only supplies a last-resort filename when the transaction has
      // neither reference nor id. Pre-existing; flagged now only because adding
      // a catch made the compiler analyse further into this handler.
      // eslint-disable-next-line react-hooks/purity
      link.download = `glass-receipt-${tx?.reference ?? tx?.id ?? Date.now()}.png`;
      link.click();
    } catch (err) {
      // html2canvas rejects when it cannot load a cross-origin image (an <img>
      // served without Access-Control-Allow-Origin), and toDataURL throws a
      // SecurityError on an origin-tainted canvas. Both used to escape as an
      // unhandled rejection with no feedback at all — the click just appeared to
      // do nothing. Report them; the sibling modals use notifyError too.
      notifyError(err, {
        context: "Saving receipt image",
        fallback: "Couldn't save the image. Please try again.",
      });
    } finally {
      setSaving(null);
    }
  }

  async function handleSavePdf() {
    if (saving) return;
    setSaving("pdf");
    try {
      const { downloadReceiptPdf } = await import("../../utils/generateReceipt");
      await downloadReceiptPdf(tx, { payerName, payerEmail });
    } catch (err) {
      notifyError(err, {
        context: "Saving receipt PDF",
        fallback: "Couldn't save the receipt PDF. Please try again.",
      });
    } finally {
      setSaving(null);
    }
  }

  async function handleShare() {
    if (saving) return;
    setSaving("share");
    try {
      const canvas = await captureCard(2);
      if (!canvas) return;
      // toBlob is callback-based and fires AFTER this try block would otherwise
      // close, so awaiting it through a Promise is what lets `finally` below
      // stay correct: saving must not reset until the share sheet resolves, or
      // the button re-enables while the sheet is still up.
      await new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          try {
            if (!blob) {
              notifyError(new Error("Receipt capture produced no image data"), {
                context: "Sharing receipt",
                fallback: "Couldn't share the receipt. Please try again.",
              });
              return;
            }
            await navigator.share({
              files: [
                new File([blob], `glass-receipt-${tx?.reference ?? tx?.id ?? ""}.png`, {
                  type: "image/png",
                }),
              ],
              title: "Payment Receipt",
            });
          } catch {
            // user dismissed — not an error. Deliberately silent.
          } finally {
            resolve();
          }
        }, "image/png");
      });
    } catch (err) {
      // Capture failures (html2canvas rejecting, or toBlob throwing
      // SecurityError on a tainted canvas) previously landed in a bare catch
      // that only reset state, so a failure was indistinguishable from a
      // dismissed share sheet.
      notifyError(err, {
        context: "Sharing receipt",
        fallback: "Couldn't share the receipt. Please try again.",
      });
    } finally {
      // finally, not catch: `if (!canvas) return` inside the try skips a catch
      // clause, which previously left saving === "share" stuck forever with the
      // button permanently disabled. Every exit path must reset.
      setSaving(null);
    }
  }

  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof File !== "undefined";

  const actionBtn = (onClick, isActive, children, primary = false) => (
    <Button
      onClick={onClick}
      disabled={!!saving}
      variant={primary ? "primary" : "tonal"}
      size="sm"
      fullWidth={false}
      className="flex-1"
    >
      {children}
    </Button>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      {/* Sheet — full-width bottom sheet on mobile (the member app, where
          this is meant to feel native); a normal capped-width centered
          dialog from sm: up so it doesn't swallow most of a desktop
          viewport (this component is shared with the admin dashboard). */}
      <div
        className="relative bg-brand-glow rounded-t-[20px] sm:rounded-[20px] max-h-[92dvh] sm:max-h-[85vh] sm:w-full sm:max-w-[420px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile-only affordance, meaningless on a centered desktop dialog */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sm:hidden">
          <div className="w-9 h-1 rounded-sm bg-black/15" />
        </div>

        {/* Title row */}
        <div className="flex items-center justify-between pt-2 px-5 pb-3 flex-shrink-0">
          <span className="text-[15px] font-bold text-[#0F172A]">Payment Receipt</span>
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
            className="flex-shrink-0"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Scrollable receipt */}
        <div
          style={{ WebkitOverflowScrolling: "touch" }}
          className="flex-1 overflow-y-auto px-4 pt-0 pb-3"
        >
          <ReceiptCard
            tx={tx}
            payerName={payerName}
            payerEmail={payerEmail}
            cardRef={cardRef}
            onQrReady={onQrReady}
            onQrError={onQrError}
          />
        </div>

        {/* Action bar */}
        <div className="bg-white border-t border-[#E2E8F0] flex gap-px flex-shrink-0">
          {canShare &&
            // actionBtn only ever wires this into a <button onClick>, never
            // calls it during render -- handleShare (which reads cardRef via
            // captureCard) only actually runs from that click handler. The
            // compiler can't see through the local actionBtn helper to
            // confirm that.
            actionBtn(
              // eslint-disable-next-line react-hooks/refs
              handleShare,
              saving === "share",
              <>
                <Share2 size={15} />
                {saving === "share" ? "Sharing…" : "Share"}
              </>,
            )}
          {actionBtn(
            // Same reasoning as the Share button above: actionBtn only wires
            // this into a <button onClick>, and handleSaveImage only ever runs
            // from that click — the compiler can't see through the local helper.
            // eslint-disable-next-line react-hooks/refs
            handleSaveImage,
            saving === "image",
            <>
              <ImageIcon size={15} />
              {saving === "image" ? "Saving…" : "Save Image"}
            </>,
          )}
          {actionBtn(
            handleSavePdf,
            saving === "pdf",
            <>
              <FileText size={15} />
              {saving === "pdf" ? "Saving…" : "Save PDF"}
            </>,
            true,
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
