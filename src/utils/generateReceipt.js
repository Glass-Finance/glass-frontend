import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import glassLogo from "../assets/Glass.webp";
import { toTitleCase } from "./format";
import {
  formatHeaderDate,
  maskEmail,
  splitNaira,
  statusLabel,
} from "../components/common/receiptUtils";

async function loadLogo() {
  const response = await fetch(glassLogo);
  if (!response.ok) throw new Error(`Unable to load receipt logo (${response.status})`);
  const blob = await response.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read receipt logo"));
    reader.readAsDataURL(blob);
  });
  return { dataUrl, format: blob.type.includes("png") ? "PNG" : "WEBP" };
}

function drawDashedLine(doc, x1, y, x2) {
  doc.setDrawColor(190, 192, 196);
  doc.setLineWidth(0.7);
  doc.setLineDashPattern([3, 3], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

function drawTicketEdge(doc, x, y, width, count, direction) {
  const scallopWidth = width / count;
  const radius = 9;
  doc.setDrawColor(205, 207, 211);
  doc.setLineWidth(0.8);
  for (let i = 0; i < count; i++) {
    const startX = x + i * scallopWidth;
    const startY = y + (direction === "top" ? radius : -radius);
    let previousX = startX;
    let previousY = startY;
    for (let step = 1; step <= 12; step++) {
      const t = step / 12;
      const nextX = startX + scallopWidth * t;
      const nextY =
        y +
        (direction === "top" ? radius : -radius) +
        (direction === "top" ? -1 : 1) * Math.sin(Math.PI * t) * radius * 2;
      doc.line(previousX, previousY, nextX, nextY);
      previousX = nextX;
      previousY = nextY;
    }
  }
}

function receiptFilename(tx) {
  return `glass-receipt-${tx.reference ?? tx.id ?? Date.now()}.pdf`;
}

/**
 * @param {any} tx
 * @param {{ payerName?: string, payerEmail?: string }} [opts]
 */
export async function downloadReceiptPdf(tx, { payerName, payerEmail } = {}) {
  const logo = await loadLogo();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 54;
  const left = margin - 10;
  const right = pageWidth - margin + 10;
  const contentWidth = right - left;
  const top = 44;
  const bottom = 564;
  const sideTop = top + 9;
  const sideBottom = bottom - 9;
  const transactionId = tx?.reference ?? tx?.id;

  doc.setFillColor(249, 250, 252);
  doc.rect(left, sideTop, contentWidth, sideBottom - sideTop, "F");
  doc.setDrawColor(205, 207, 211);
  doc.setLineWidth(0.8);
  doc.line(left, sideTop, left, sideBottom);
  doc.line(right, sideTop, right, sideBottom);
  drawTicketEdge(doc, left, top + 9, contentWidth, 15, "top");
  drawTicketEdge(doc, left, bottom - 9, contentWidth, 15, "bottom");

  doc.addImage(logo.dataUrl, logo.format, left + 18, top + 23, 42, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text("Transaction Receipt", right - 18, top + 48, { align: "right" });

  const amount = splitNaira(tx?.amount);
  const amountY = top + 130;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(27);
  doc.setTextColor(10, 10, 10);
  const wholeWidth = doc.getTextWidth(amount.whole);
  const decimalWidth = doc.getTextWidth(amount.decimals);
  const amountStart = pageWidth / 2 - (wholeWidth + decimalWidth) / 2;
  doc.text(amount.whole, amountStart, amountY);
  doc.setTextColor(115, 115, 115);
  doc.text(amount.decimals, amountStart + wholeWidth, amountY);

  const status = statusLabel(tx?.status);
  doc.setFontSize(12);
  if (status === "Successful") doc.setTextColor(0, 138, 18);
  else if (status === "Failed") doc.setTextColor(208, 0, 0);
  else doc.setTextColor(183, 121, 0);
  doc.text(status, pageWidth / 2, amountY + 24, { align: "center" });
  if (status === "Successful") {
    const checkX = pageWidth / 2 - doc.getTextWidth(status) / 2 - 13;
    const checkY = amountY + 20;
    doc.setDrawColor(0, 138, 18);
    doc.setLineWidth(1.5);
    doc.line(checkX, checkY, checkX + 3, checkY + 3);
    doc.line(checkX + 3, checkY + 3, checkX + 8, checkY - 3);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(105, 105, 105);
  doc.text(formatHeaderDate(tx?.date ?? tx?.createdAt), pageWidth / 2, amountY + 51, {
    align: "center",
  });

  const detailLeft = left + 20;
  const detailRight = right - 20;
  drawDashedLine(doc, detailLeft, top + 206, detailRight);
  const rows = [
    ["Recipient Community:", tx?.communityName ?? "—"],
    ["Payment Plan:", toTitleCase(tx?.planName ?? tx?.description) || "—"],
    ["Transaction ID:", transactionId ?? "—"],
  ];
  let rowY = top + 240;
  rows.forEach(([label, value], index) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(label, detailLeft, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(10, 10, 10);
    doc.text(String(value), detailRight, rowY, {
      align: "right",
      maxWidth: contentWidth * 0.57,
    });
    if (index < rows.length - 1) drawDashedLine(doc, detailLeft, rowY + 12, detailRight);
    rowY += 30;
  });

  drawDashedLine(doc, detailLeft, rowY + 6, detailRight);
  const payerTop = rowY + 24;
  doc.setFillColor(240, 241, 243);
  doc.roundedRect(detailLeft, payerTop, 245, 58, 5, 5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(95, 95, 95);
  doc.text("Paid by:", detailLeft + 12, payerTop + 23);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(10, 10, 10);
  doc.text(toTitleCase(payerName) || "—", detailLeft + 52, payerTop + 23, {
    maxWidth: 180,
  });
  const email = maskEmail(payerEmail);
  if (email) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(105, 105, 105);
    doc.text(email, detailLeft + 12, payerTop + 43);
  }

  if (transactionId != null && transactionId !== "") {
    const qrDataUrl = await QRCode.toDataURL(String(transactionId), {
      width: 256,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    const qrSize = 92;
    doc.addImage(qrDataUrl, "PNG", detailRight - qrSize, payerTop - 12, qrSize, qrSize);
  }

  doc.save(receiptFilename(tx));
}
