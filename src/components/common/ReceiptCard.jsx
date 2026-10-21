import { Check } from "lucide-react";
import logo from "../../assets/Glass.webp";
import { toTitleCase } from "../../utils/format";
import QRCodeCanvas from "./QRCodeCanvas";
import { formatHeaderDate, maskEmail, splitNaira, statusLabel } from "./receiptUtils";

function TicketEdge({ bottom = false }) {
  const path = Array.from({ length: 10 }, (_, index) => {
    const x = index * 70;
    return bottom
      ? `C${x + 18} 2 ${x + 18} 22 ${x + 35} 22 C${x + 52} 22 ${x + 52} 2 ${x + 70} 2`
      : `C${x + 18} 22 ${x + 18} 2 ${x + 35} 2 C${x + 52} 2 ${x + 52} 22 ${x + 70} 22`;
  }).join(" ");

  return (
    <svg
      aria-hidden="true"
      data-testid={bottom ? "receipt-bottom-edge" : "receipt-top-edge"}
      viewBox="0 0 700 24"
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height: 24, flexShrink: 0 }}
    >
      <path d={`M0 ${bottom ? 2 : 22} ${path}`} fill="none" stroke="#E1E2E5" strokeWidth="2" />
    </svg>
  );
}

function ReceiptRow({ label, children, last = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "10px 0",
        borderBottom: last ? "none" : "1px dashed #C8C9CD",
      }}
    >
      <span style={{ color: "#686868", fontSize: 14, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: "#090909",
          fontSize: 14,
          fontWeight: 500,
          textAlign: "right",
          overflowWrap: "anywhere",
        }}
      >
        {children}
      </span>
    </div>
  );
}

export default function ReceiptCard({ tx, payerName, payerEmail, cardRef, onQrReady, onQrError }) {
  const status = statusLabel(tx?.status);
  const amountParts = splitNaira(tx?.amount);
  const transactionId = tx?.reference ?? tx?.id;
  const maskedEmail = maskEmail(payerEmail);
  const statusColor =
    status === "Successful" ? "#008A12" : status === "Failed" ? "#D00000" : "#B77900";

  return (
    <div
      ref={cardRef}
      data-testid="transaction-receipt"
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "0 18px",
        borderLeft: "1px solid #E1E2E5",
        borderRight: "1px solid #E1E2E5",
        color: "#090909",
        background: "linear-gradient(180deg, #FFFFFF 0%, #F8F9FC 100%)",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, sans-serif',
      }}
    >
      <TicketEdge />

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "20px 0 24px",
        }}
      >
        <img src={logo} width={56} height={56} alt="Glass" style={{ objectFit: "contain" }} />
        <span style={{ fontSize: 17, fontWeight: 500, textAlign: "right" }}>
          Transaction Receipt
        </span>
      </header>

      <div style={{ textAlign: "center", paddingBottom: 22 }}>
        <div style={{ fontSize: 32, lineHeight: 1.2, fontWeight: 500 }}>
          <span>{amountParts.whole}</span>
          <span style={{ color: "#777777" }}>{amountParts.decimals}</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            marginTop: 7,
            color: statusColor,
            fontSize: 17,
            fontWeight: 500,
          }}
        >
          {status === "Successful" && <Check size={17} strokeWidth={3} />}
          {status}
        </div>
        <div style={{ color: "#6B6B6B", fontSize: 15, marginTop: 18 }}>
          {formatHeaderDate(tx?.date ?? tx?.createdAt)}
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #C8C9CD", padding: "18px 0 14px" }}>
        <ReceiptRow label="Recipient Community:">{tx?.communityName ?? "—"}</ReceiptRow>
        <ReceiptRow label="Payment Plan:">
          {toTitleCase(tx?.planName ?? tx?.description) || "—"}
        </ReceiptRow>
        <ReceiptRow label="Transaction ID:" last>
          {transactionId ?? "—"}
        </ReceiptRow>
      </div>

      <div
        style={{
          borderTop: "1px dashed #C8C9CD",
          paddingTop: 18,
          paddingBottom: 6,
        }}
      >
        <div
          style={{
            borderRadius: 5,
            background: "#F1F2F4",
            padding: "14px 12px",
            color: "#686868",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <div>
            Paid by:{" "}
            <span style={{ color: "#090909", fontWeight: 500 }}>
              {toTitleCase(payerName) || "—"}
            </span>
          </div>
          {maskedEmail && <div style={{ marginTop: 2 }}>{maskedEmail}</div>}
        </div>
      </div>

      {transactionId != null && transactionId !== "" && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 0 24px" }}>
          <QRCodeCanvas
            value={String(transactionId)}
            size={128}
            color="#000000"
            onReady={onQrReady}
            onError={onQrError}
          />
        </div>
      )}

      <TicketEdge bottom />
    </div>
  );
}
