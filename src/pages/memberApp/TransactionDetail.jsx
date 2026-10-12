import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Copy, CheckCheck, Share2 } from "lucide-react";
import { useTransactionDetail } from "../../hooks/useTransactionDetail";
import { useAuth } from "../../store/AuthContext";
import GlassLogoGlow from "../../components/memberApp/GlassLogoGlow";
import PageLoadingState from "../../components/common/PageLoadingState";
import ReceiptModal from "../../components/common/ReceiptModal";
import { formatNaira, toTitleCase } from "../../utils/format";
import { transactionStatusStyle } from "../../utils/transactionStatus";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { MobileBackButton } from "../../components/ui/MobileBackButton";

function StatusPill({ status }) {
  const { label, ...s } = transactionStatusStyle(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg py-1.5 px-3.5 ${s.cls}`}
    >
      {label === "Success" && (
        <span
          className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${s.dotCls}`}
        >
          <Check size={11} color="var(--color-white)" strokeWidth={3} />
        </span>
      )}
      {s.text}
    </span>
  );
}

function Row({ label, children, last }) {
  return (
    <div
      className={`flex items-start justify-between gap-4 py-3.5 ${last ? "border-none" : "border-b border-stacked-container"}`}
    >
      <span className="text-sm text-ink-muted flex-shrink-0 pt-px">{label}</span>
      <span className="text-sm font-semibold text-ink text-right break-words max-w-[62%]">
        {children}
      </span>
    </div>
  );
}

export default function TransactionDetail() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { transactionId } = useParams();
  const { data: tx, isLoading, error } = useTransactionDetail(transactionId);
  const [copied, copy] = useCopyToClipboard(1500);
  const [shareOpen, setShareOpen] = useState(false);
  const payerName = toTitleCase(
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "",
  );

  function copyReference() {
    copy(tx?.reference);
  }

  return (
    <div className="relative overflow-hidden min-h-screen pb-10 max-w-[430px] mx-auto">
      <GlassLogoGlow />
      {/* Header */}
      <div className="relative flex items-center justify-center pt-5 px-4 pb-4">
        <MobileBackButton
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="absolute left-4"
        />
        <h1 className="text-lg font-medium text-ink m-0">Transaction Details</h1>
      </div>

      {isLoading ? (
        <PageLoadingState />
      ) : error || !tx ? (
        <div className="py-10 px-5 text-center">
          <p className="text-sm text-danger">Couldn't load this transaction.</p>
        </div>
      ) : (
        <div className="py-0 px-4 flex flex-col gap-3">
          {/* Amount card */}
          <div className="bg-white rounded-2xl pt-7 px-5 pb-7 border border-surface-container-border flex flex-col items-center gap-3">
            <p className="text-[34px] font-bold text-ink m-0 tracking-[-0.5px]">
              {formatNaira(tx.amount, { decimals: 2 })}
            </p>
            <StatusPill status={tx.status} />
            <p className="text-[13px] text-ink-faint m-0">
              {tx.date
                ? new Date(tx.date)
                    .toLocaleString("en-NG", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                    .replace(",", " •")
                : "—"}
            </p>
          </div>

          {/* Details card */}
          <div className="bg-white rounded-2xl pt-[18px] px-5 pb-[18px] border border-surface-container-border">
            <p className="text-[15px] font-semibold text-ink mt-0 mx-0 mb-1.5">
              Transaction Details
            </p>

            <Row label="Community:">
              <span className="flex items-center gap-2">
                {tx.communityLogo?.url && (
                  <img
                    src={tx.communityLogo.url}
                    alt=""
                    className="w-8 h-8 object-cover"
                    loading="lazy"
                  />
                )}
                {tx.communityName ?? "—"}
              </span>
            </Row>
            <Row label="Plan:" last={!tx.transactionType && !tx.channel}>
              {toTitleCase(tx.planName ?? tx.description) ?? "—"}
            </Row>
            {(tx.transactionType || tx.channel) && (
              <Row label="Transaction Type:">{toTitleCase(tx.transactionType ?? tx.channel)}</Row>
            )}
            <Row label="Dues Amount:">{formatNaira(tx.amount)}</Row>
            {/* Always shown, never conditional -- transparency about the
                fee is the point, so the row itself never disappears. The
                value can still be "—" though: Glass's fee is set
                per-community (there's a platform-admin override for it),
                not a fixed rate, so there's no formula to fall back on --
                asserting a specific ₦0.00 when we don't have the real
                number would be a false claim, the opposite of transparent. */}
            <Row label="Transaction Fee:">
              {tx.feeMinor != null ? formatNaira(tx.feeMinor, { decimals: 2 }) : "—"}
            </Row>
            <Row label="Transaction ID:" last={!tx.initiatedBy}>
              <span className="break-all">{tx.reference ?? tx.id}</span>{" "}
              <span className="inline-flex align-middle">
                <Button
                  variant="tertiary"
                  size="icon-sm"
                  onClick={copyReference}
                  aria-label="Copy transaction ID"
                >
                  {copied ? <CheckCheck size={13} className="text-success" /> : <Copy size={13} />}
                </Button>
              </span>
            </Row>
            {tx.initiatedBy && (
              <Row label="Initiated by:" last>
                <span className="inline-block bg-brand-mist text-brand text-xs font-semibold rounded-full py-[3px] px-3">
                  {tx.initiatedBy}
                </span>
              </Row>
            )}
          </div>

          <Button variant="outline" onClick={() => setShareOpen(true)}>
            <Share2 size={15} />
            Share Receipt
          </Button>
        </div>
      )}

      {shareOpen && tx && (
        <ReceiptModal
          tx={tx}
          payerName={payerName}
          payerEmail={user?.email}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
