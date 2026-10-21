import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { formatNaira as sharedFormatNaira, toTitleCase } from "./format";

function formatNaira(amount) {
  return sharedFormatNaira(amount, { decimals: 2 });
}

function formatDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Compact "Apr 1,2025 • 12:00AM" -- matches the in-app receipt's header
// format; built by hand since toLocaleString's "en-NG" locale defaults to a
// 24-hour clock with no AM/PM marker.
function formatHeaderDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${month} ${day},${year} • ${hours}:${minutes}${ampm}`;
}

function statusLabel(status) {
  const s = (status ?? "").toLowerCase();
  if (s === "success" || s === "successful") return "Successful";
  if (s === "failed") return "Failed";
  return "Pending";
}

// Cosmetic masking for the Member Details row (e.g. "am**bu@gmail.com") — the
// PDF is only ever downloaded by the payer themselves or an admin who already
// has this member's full record elsewhere, so this is polish, not privacy.
function maskEmail(email) {
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  if (local.length <= 4) return `${local[0]}**@${domain}`;
  return `${local.slice(0, 2)}**${local.slice(-2)}@${domain}`;
}

function receiptRows(tx, payerName, payerEmail) {
  const maskedEmail = maskEmail(payerEmail);
  const memberDetails = [toTitleCase(payerName) || "—", maskedEmail]
    .filter(Boolean)
    .join("   ·   ");

  return [
    ["Community", tx.communityName ?? "—"],
    ["Plan", toTitleCase(tx.planName ?? tx.description) || "—"],
    ["Member Details", memberDetails],
    ["Transaction Type", toTitleCase(tx.channel) || "—"],
    ["Dues Amount", formatNaira(tx.amount)],
    // Always shown, never conditional -- transparency about the fee is the
    // point, so the row itself never disappears. The value can still be
    // "—" though: Glass's fee is set per-community, not a fixed rate, so
    // there's no formula to fall back on -- asserting a specific ₦0.00
    // when we don't have the real number would be a false claim.
    ["Transaction Fee", tx.feeMinor != null ? formatNaira(tx.feeMinor) : "—"],
  ];
}

// Same fetch-and-inline-as-base64 approach ReceiptModal.jsx uses for the
// Glass logo -- jsPDF's addImage() needs the raw image data, not a URL, and
// this also sidesteps the payer photo URL potentially requiring credentials
// jsPDF's own fetch wouldn't send. Resolves to null (never throws) on any
// failure so a broken/expired photo URL just omits the avatar, same as
// leaving payerPhoto unset.
async function fetchImageAsB64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const format = blob.type.includes("png") ? "PNG" : blob.type.includes("webp") ? "WEBP" : "JPEG";
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    return dataUrl ? { dataUrl, format } : null;
  } catch {
    return null;
  }
}

function receiptFilename(tx, ext) {
  return `glass-receipt-${tx.reference ?? tx.id ?? Date.now()}.${ext}`;
}

// Approximates the app's 135deg purple-to-blue brand gradient as a left-to-
// right band — jsPDF has no native gradient fill, so this interpolates the
// same two brand colors used everywhere else (Sidebar CTA, receipt header)
// across thin vertical strips.
function drawGradientBand(doc, x, y, w, h, [r1, g1, b1], [r2, g2, b2], steps = 48) {
  const stepW = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.setFillColor(
      Math.round(r1 + (r2 - r1) * t),
      Math.round(g1 + (g2 - g1) * t),
      Math.round(b1 + (b2 - b1) * t),
    );
    doc.rect(x + stepW * i, y, stepW + 0.5, h, "F");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF receipt — clean document layout, branded gradient header band.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {any} tx
 * @param {{ payerName?: string, payerEmail?: string }} [opts]
 */
export async function downloadReceiptPdf(tx, { payerName, payerEmail } = {}) {
  const avatar = await fetchImageAsB64(tx.payerPhoto);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 56;
  const headerH = 150;

  // Full-width gradient header band - Figma purple (#6b2fb5) to Glass blue
  // (#002fa7). Was #7C3AED, Tailwind violet, which is not in the design file.
  drawGradientBand(doc, 0, 0, W, headerH, [107, 47, 181], [0, 47, 167]);

  // Scalloped ticket edge -- white circles centered on the page's top edge,
  // clipped by the page boundary so only their bottom half shows, biting
  // into the gradient band. Matches the in-app receipt's same treatment.
  doc.setFillColor(255, 255, 255);
  const dotR = 8;
  const dotCount = 14;
  const dotMargin = 24;
  const dotSpan = (W - dotMargin * 2) / (dotCount - 1);
  for (let i = 0; i < dotCount; i++) {
    doc.circle(dotMargin + dotSpan * i, 0, dotR, "F");
  }

  // Glass wordmark
  doc.setFont("helvetica", "normal");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("Glass", margin, 52);

  // "Transaction Receipt" label top-right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(215, 222, 245);
  doc.text("Transaction Receipt", W - margin, 52, { align: "right" });

  // Amount
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(255, 255, 255);
  doc.text(formatNaira(tx.amount), margin, 106);

  // Status
  const status = statusLabel(tx.status);
  const isSuccess = status === "Successful";
  const isFailed = status === "Failed";
  const [sr, sg, sb] = isSuccess ? [14, 206, 123] : isFailed ? [239, 68, 68] : [245, 158, 11];
  doc.setFontSize(11);
  doc.setTextColor(sr, sg, sb);
  doc.text(status.toUpperCase(), W - margin, 106, { align: "right" });

  // Timestamp
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(190, 200, 230);
  doc.text(formatHeaderDate(tx.date ?? tx.createdAt), margin, 126);

  // Section label
  let y = headerH + 44;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("TRANSACTION DETAILS", margin, y);
  y += 22;

  // Detail rows
  const rows = receiptRows(tx, payerName, payerEmail);
  doc.setFontSize(11);

  for (let i = 0; i < rows.length; i++) {
    const [label, value] = rows[i];

    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 255);
      doc.rect(margin - 8, y - 15, W - (margin - 8) * 2, 26, "F");
    }

    // Member Details is the one row that gets a photo-or-nothing avatar --
    // circular clip via jsPDF's save/clip/discard graphics-state calls,
    // matching the circular photo already used in the in-app card.
    let labelX = margin;
    if (label === "Member Details" && avatar) {
      const r = 9;
      const cx = margin + r;
      const cy = y - 4;
      doc.saveGraphicsState();
      doc.circle(cx, cy, r, null);
      doc.clip();
      doc.discardPath();
      doc.addImage(avatar.dataUrl, avatar.format, cx - r, cy - r, r * 2, r * 2);
      doc.restoreGraphicsState();
      labelX = margin + r * 2 + 6;
    }

    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(label, labelX, y);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(String(value), W - margin, y, { align: "right", maxWidth: W * 0.52 });

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.5);
    doc.line(margin - 8, y + 11, W - margin + 8, y + 11);

    y += 34;
  }

  // Reference
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("TRANSACTION ID", margin, y);
  y += 12;

  // Left accent bar for reference
  doc.setFillColor(0, 47, 167);
  doc.rect(margin - 8, y - 2, 3, 20, "F");
  doc.setFillColor(248, 250, 255);
  doc.rect(margin - 5, y - 2, W - (margin - 5) - margin + 8, 20, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  const transactionId = tx.reference ?? tx.id;
  const refLines = doc.splitTextToSize(String(transactionId ?? "—"), W - margin * 2 - 8);
  doc.text(refLines, margin, y + 12);
  y += (refLines.length - 1) * 14 + 32;

  if (transactionId != null && transactionId !== "") {
    const qrDataUrl = await QRCode.toDataURL(String(transactionId), {
      width: 128,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    const qrSize = 64;
    const qrX = W - margin - qrSize;
    doc.addImage(qrDataUrl, "PNG", qrX, y, qrSize, qrSize);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("SCAN FOR TRANSACTION ID", qrX + qrSize / 2, y + qrSize + 10, {
      align: "center",
    });
    y += qrSize + 24;
  }

  // Footer
  doc.setFillColor(250, 251, 255);
  doc.rect(margin - 8, y - 12, W - (margin - 8) * 2, 48, "F");
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("glasspay.app", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated ${formatDateTime(new Date())}`, W - margin, y, { align: "right" });

  doc.setFillColor(255, 255, 255);
  const bottomDotCount = 14;
  const bottomDotMargin = 24;
  const bottomDotSpan = (W - bottomDotMargin * 2) / (bottomDotCount - 1);
  for (let i = 0; i < bottomDotCount; i++) {
    doc.circle(bottomDotMargin + bottomDotSpan * i, y + 28, 7, "F");
  }

  doc.save(receiptFilename(tx, "pdf"));
}
