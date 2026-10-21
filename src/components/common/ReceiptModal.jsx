import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { createPortal } from "react-dom";
import { X, FileText, Image as ImageIcon, Share2, Check, Copy, CheckCheck } from "lucide-react";
import ctaLogoUrl from "../../assets/cta/ctalogo.webp";
import { toTitleCase } from "../../utils/format";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { notifyError } from "../../utils/errorHandler";
import QRCodeCanvas from "./QRCodeCanvas";
import {
  formatNaira,
  splitNaira,
  formatDateTime,
  formatHeaderDate,
  statusLabel,
  maskEmail,
  getInitials,
} from "./receiptUtils";

// Photo-or-initials circle for the Member Details row. Plain <img>/div with
// borderRadius: "50%" rather than a CSS mask -- html2canvas (used for Save
// Image/Share) already renders that reliably elsewhere on this same card
// (the ticket-edge dots, the status checkmark circle), it's only
// mask-image/repeating-gradients it struggles with.
function Avatar({ photo, name, size = 28 }) {
  return photo ? (
    <img
      src={photo}
      alt=""
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
      }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background:
          "linear-gradient(135deg, var(--color-accent-purple) 0%, var(--color-brand) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: "var(--color-white)",
          fontSize: size * 0.38,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {getInitials(name)}
      </span>
    </div>
  );
}

function DetailRow({ label, children, last }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 20,
        padding: "13px 28px",
        borderBottom: last ? "none" : "1px solid #F1F5F9",
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: "#94A3B8",
          whiteSpace: "nowrap",
          flexShrink: 0,
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "#0F172A",
          fontWeight: 600,
          textAlign: "right",
          wordBreak: "break-word",
          maxWidth: "62%",
        }}
      >
        {children}
      </span>
    </div>
  );
}

// ── ReceiptCard — rendered as real JSX for the in-app preview ────────────────
// The outer card and logo stay square; the ticket scallops intentionally overlap its edges.

function ReceiptCard({
  tx,
  payerName,
  payerEmail,
  logoB64,
  footerLogoB64,
  cardRef,
  copied,
  onCopyReference,
}) {
  const status = statusLabel(tx?.status);
  const isSuccess = status === "Successful";
  const isFailed = status === "Failed";

  const statusColor = isSuccess ? "var(--color-white)" : isFailed ? "#FCA5A5" : "#FDE68A";

  const refValue = tx?.reference ?? tx?.id ?? "—";
  const qrValue = tx?.reference ?? tx?.id;
  const maskedEmail = maskEmail(payerEmail);
  const amountParts = splitNaira(tx?.amount);

  return (
    <div
      ref={cardRef}
      style={{
        width: "100%",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, sans-serif',
        background: "var(--color-white)",
        // no border-radius anywhere on the outer container
      }}
    >
      {/* ── Scalloped ticket edge — plain white circles (matching the card's
          own white body, not the modal sheet behind it) that overlap the
          header's top corners via negative margin, biting into the
          gradient in normal document flow. DOM circles rather than a CSS
          mask/gradient specifically because this card is also captured by
          html2canvas for Save Image/Share/PDF, which has weak support for
          masks and repeating gradients but renders plain bordered/rounded
          divs reliably. ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0 12px",
          marginBottom: -8,
          position: "relative",
          zIndex: 2,
        }}
      >
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "var(--color-white)",
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* ── HEADER — brand gradient, matches the accent used on Sidebar/CTA
          surfaces elsewhere in the app (135deg, purple to Glass blue) ── */}
      <div
        style={{
          background:
            "linear-gradient(135deg, var(--color-accent-purple) 0%, var(--color-brand) 100%)",
          padding: "28px 28px 32px",
        }}
      >
        {/* Logo row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 36,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {logoB64 ? (
              <img
                src={logoB64}
                width={30}
                height={30}
                alt=""
                style={{ display: "block" }}
                loading="lazy"
              />
            ) : (
              <div
                style={{
                  width: 30,
                  height: 30,
                  background: "rgba(255,255,255,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    color: "var(--color-white)",
                    fontSize: 15,
                    fontWeight: 900,
                    lineHeight: 1,
                  }}
                >
                  G
                </span>
              </div>
            )}
            <span
              style={{
                color: "var(--color-white)",
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              Glass
            </span>
          </div>
          <span
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Transaction Receipt
          </span>
        </div>

        {/* Amount + status */}
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 14, lineHeight: 1 }}>
            <span
              style={{
                color: "var(--color-white)",
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: "-1px",
              }}
            >
              {amountParts.whole}
            </span>
            <span
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: "-1px",
              }}
            >
              {amountParts.decimals}
            </span>
          </div>

          {/* Status — flat checkmark + label, no pill container */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                width: 15,
                height: 15,
                borderRadius: "50%",
                background: isSuccess ? "#0ECE7B" : isFailed ? "#EF4444" : "#F59E0B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {isSuccess && <Check size={10} color="var(--color-white)" strokeWidth={3.5} />}
            </span>
            <span
              style={{
                color: statusColor,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.2px",
              }}
            >
              {status}
            </span>
          </div>

          {/* Timestamp */}
          <div
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 11.5,
              letterSpacing: "0.2px",
            }}
          >
            {formatHeaderDate(tx?.date ?? tx?.createdAt)}
          </div>
        </div>
      </div>

      {/* ── TRANSACTION DETAILS ───────────────────────────────────────────── */}
      <div style={{ background: "var(--color-white)" }}>
        <DetailRow label="Community">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              justifyContent: "flex-end",
            }}
          >
            {tx?.communityLogo?.url && (
              <img
                src={tx.communityLogo.url}
                alt=""
                width={32}
                height={32}
                style={{ objectFit: "cover", flexShrink: 0 }}
              />
            )}
            {tx?.communityName ?? "—"}
          </span>
        </DetailRow>

        <DetailRow label="Plan">{toTitleCase(tx?.planName ?? tx?.description) ?? "—"}</DetailRow>

        <DetailRow label="Member Details">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <Avatar photo={tx?.payerPhoto} name={payerName} />
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 2,
              }}
            >
              <span>{toTitleCase(payerName) || "—"}</span>
              {maskedEmail && (
                <span style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8" }}>
                  {maskedEmail}
                </span>
              )}
            </span>
          </span>
        </DetailRow>

        <DetailRow label="Transaction Type">{toTitleCase(tx?.channel) || "—"}</DetailRow>

        <DetailRow label="Dues Amount">{formatNaira(tx?.amount)}</DetailRow>

        {/* Always shown, never conditional -- transparency about the fee is
            the point, so the row itself never disappears. The value can
            still be "—" though: Glass's fee is set per-community (there's
            a platform-admin override for it), not a fixed rate, so there's
            no formula to fall back on -- and asserting a specific ₦0.00
            when we simply don't have the real number would be a false
            claim, the opposite of transparent. */}
        <DetailRow label="Transaction Fee">
          {tx?.feeMinor != null ? formatNaira(tx.feeMinor) : "—"}
        </DetailRow>

        <DetailRow label="Transaction ID" last>
          <span style={{ wordBreak: "break-all" }}>{refValue}</span>{" "}
          <Button
            variant="tertiary"
            size="icon-sm"
            onClick={onCopyReference}
            aria-label="Copy transaction ID"
            className="align-middle"
          >
            {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
          </Button>
        </DetailRow>
      </div>

      {qrValue != null && qrValue !== "" && (
        <div
          role="img"
          aria-label="QR code for transaction ID"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            padding: "12px 28px 16px",
          }}
        >
          <QRCodeCanvas value={String(qrValue)} size={96} color="#000000" />
          <span style={{ fontSize: 9, color: "#64748B", letterSpacing: "0.3px" }}>
            SCAN FOR TRANSACTION ID
          </span>
        </div>
      )}

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "11px 28px 15px",
          borderTop: "1px solid #F1F5F9",
          background: "#FAFBFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {footerLogoB64 && (
            <img
              src={footerLogoB64}
              width={13}
              height={13}
              alt=""
              style={{ display: "block", opacity: 0.35 }}
            />
          )}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#64748B",
              letterSpacing: "0.3px",
            }}
          >
            glasspay.app
          </span>
        </div>
        <span style={{ fontSize: 10, color: "#94A3B8" }}>
          Generated {formatDateTime(new Date())}
        </span>
      </div>

      <div
        aria-hidden="true"
        data-testid="receipt-bottom-edge"
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0 12px",
          marginTop: -8,
          position: "relative",
          zIndex: 2,
        }}
      >
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "var(--color-white)",
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Modal (bottom sheet) ──────────────────────────────────────────────────────

export default function ReceiptModal({ tx, payerName, payerEmail, onClose }) {
  const cardRef = useRef(null);
  // Two variants: the silver/grey mark reads correctly against the gradient
  // header, but is too low-contrast at the small, faded opacity the footer
  // uses on a near-white background -- the footer keeps the colored mark.
  const [logoB64, setLogoB64] = useState(null);
  const [footerLogoB64, setFooterLogoB64] = useState(null);
  const [saving, setSaving] = useState(null); // "image" | "pdf" | "share" | null
  const [copied, copy] = useCopyToClipboard(1500);

  useEffect(() => {
    function toB64(blob) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }
    fetch(ctaLogoUrl)
      .then((r) => r.blob())
      .then(toB64)
      .then(setLogoB64)
      .catch(() => {});
    fetch("/Glass.webp")
      .then((r) => r.blob())
      .then(toB64)
      .then(setFooterLogoB64)
      .catch(() => {});
  }, []);

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

  function copyReference() {
    copy(tx?.reference ?? tx?.id);
  }

  async function captureCard(scale = 3) {
    if (!cardRef.current) return null;
    // Dynamically imported rather than at module scope, matching the jspdf
    // pattern in generateReceipt.js: html2canvas is ~200 kB and only needed
    // when the member actually taps Save Image or Share — not on every render
    // of the receipt modal.
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(cardRef.current, {
      scale,
      backgroundColor: "var(--color-white)",
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
            logoB64={logoB64}
            footerLogoB64={footerLogoB64}
            cardRef={cardRef}
            copied={copied}
            onCopyReference={copyReference}
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
