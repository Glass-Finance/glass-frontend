import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Download, Gift, Loader2 } from "lucide-react";
import { useTransactions } from "../../hooks/useTransactions";
import GlassLogoGlow from "../../components/memberApp/GlassLogoGlow";
import { TransactionsSkeleton } from "../../components/memberApp/MemberPageSkeletons";
import { Button } from "../../components/ui/Button";
import { formatNaira, toTitleCase } from "../../utils/format";
import { transactionStatusLabel, transactionStatusStyle } from "../../utils/transactionStatus";
import { useExportJob } from "../../hooks/useExportJob";
import { exportMyTransactions } from "../../api/exports";
import MemberPageHeader from "../../components/memberApp/MemberPageHeader";

const STATUS_OPTIONS = ["All Status", "Success", "Failed", "Pending"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function monthLabel(dateStr) {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
  });
}

// Short form for the month-picker button ("May 2026" -> "May") — the year
// still disambiguates internally via the full label, just not shown here.
function monthShort(label) {
  return label.split(" ")[0];
}

function StatusBadge({ status }) {
  const { label, cls } = transactionStatusStyle(status);
  return (
    <span className={`inline-block text-xs font-semibold rounded-md py-0.5 px-2.5 ${cls}`}>
      {label}
    </span>
  );
}

// ─── Simple dropdown ──────────────────────────────────────────────────────────
function Dropdown({ value, options, onChange, optionLabel = (opt) => opt }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <Button variant="outline" size="sm" fullWidth={false} onClick={() => setOpen((o) => !o)}>
        {optionLabel(value)}
        <ChevronDown size={14} className="text-ink-muted" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="border border-surface-container-border absolute left-0 bg-white rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.1)] z-20 min-w-[140px] overflow-hidden [top:calc(100%+6px)]">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`block w-full text-left py-2.5 px-4 text-sm border-none cursor-pointer ${opt === value ? "text-[#2563eb] font-semibold bg-[#eff6ff]" : "text-ink font-normal bg-transparent"}`}
              >
                {optionLabel(opt)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────
function TxRow({ tx, onOpen }) {
  return (
    <div
      onClick={() => onOpen(tx)}
      className="flex items-center justify-between gap-2 py-3.5 px-5 border-b border-stacked-container cursor-pointer"
    >
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-ink m-0">{toTitleCase(tx.description)}</p>
        <p className="text-[13px] text-ink-faint mt-0.5 mx-0 mb-0">
          {tx.communityName}
          {tx.communityName ? " · " : ""}
          {tx.date
            ? new Date(tx.date).toLocaleDateString("en-NG", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—"}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[15px] font-semibold text-ink mt-0 mx-0 mb-1">
          {formatNaira(tx.amount)}
        </p>
        <StatusBadge status={tx.status} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Transactions() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const { data: transactions = [], isLoading, error, refetch } = useTransactions();

  // Real backend export job rather than a client-side CSV, which would only
  // cover rows already loaded on the page (see useExportJob.js). The status
  // filter is passed through because TransactionQueryDto supports it
  // server-side; the month picker is a client-side grouping over the full list,
  // so it deliberately isn't forwarded -- the export covers every payment of
  // the member's, matching what the backend holds for them.
  const { run: runExport, isExporting } = useExportJob();
  const STATUS_PARAM = { Success: "SUCCESS", Failed: "FAILED", Pending: "PENDING" };
  function exportCsv() {
    const status = STATUS_PARAM[statusFilter];
    runExport(() => exportMyTransactions(status ? { status } : {}));
  }

  // Month options come from the full (unfiltered-by-status) list, so
  // switching the status filter never changes which months are pickable —
  // only which of that month's rows are visible.
  const monthOptions = useMemo(() => {
    const seen = new Set();
    const months = [];
    for (const tx of transactions) {
      const key = monthLabel(tx.date);
      if (!seen.has(key)) {
        seen.add(key);
        months.push(key);
      }
    }
    return months; // already newest-first, transactions are pre-sorted
  }, [transactions]);

  // Default to the most recent month once data loads; re-anchor if the
  // current selection no longer exists (e.g. data refetched).
  useEffect(() => {
    if (monthOptions.length === 0) return;
    if (!selectedMonth || !monthOptions.includes(selectedMonth)) {
      // selectedMonth is also user-editable via the month picker, so this
      // reset-when-stale branch can't be a pure render-time derivation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedMonth(monthOptions[0]);
    }
  }, [monthOptions, selectedMonth]);

  const filtered = transactions.filter(
    (tx) => statusFilter === "All Status" || transactionStatusLabel(tx.status) === statusFilter,
  );

  // Group by month, then keep only the currently-selected month's group —
  // the month picker above the list switches which one that is.
  const groups = useMemo(() => {
    const map = new Map();
    for (const tx of filtered) {
      const key = monthLabel(tx.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(tx);
    }
    if (!selectedMonth) return Array.from(map.entries());
    return map.has(selectedMonth) ? [[selectedMonth, map.get(selectedMonth)]] : [];
  }, [filtered, selectedMonth]);

  return (
    <div className="relative mx-auto min-h-screen max-w-[430px] overflow-hidden pb-10 md:max-w-5xl">
      <GlassLogoGlow />
      {/* ── Top bar ── */}
      <MemberPageHeader
        title="Payment History"
        description="View, filter, and export your past payments."
        onBack={() => navigate(-1)}
        action={
          <Button
            variant="tertiary"
            size="icon-sm"
            onClick={exportCsv}
            disabled={isExporting}
            aria-label={isExporting ? "Preparing export" : "Export payment history as CSV"}
          >
            {isExporting ? (
              <Loader2 size={15} className="animate-spin text-ink-strong" />
            ) : (
              <Download size={15} className="text-ink-strong" />
            )}
          </Button>
        }
      />

      {/* ── Status + month filters ── */}
      <div className="pt-0 px-5 pb-3.5 flex gap-2 md:px-0">
        <Dropdown value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />
        {monthOptions.length > 0 && (
          <Dropdown
            value={selectedMonth}
            options={monthOptions}
            optionLabel={(m) => (m ? monthShort(m) : "")}
            onChange={setSelectedMonth}
          />
        )}
      </div>

      {isLoading ? (
        <TransactionsSkeleton />
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-danger text-sm mb-3">Couldn't load transactions.</p>
          <Button variant="outline-caution" size="xs" onClick={() => refetch()} fullWidth={false}>
            Try again
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <>
          <section className="hidden min-h-[470px] flex-col items-center px-6 pt-16 text-center md:flex">
            <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-[#eef1ff] text-[#5868df]">
              <Gift size={38} strokeWidth={1.7} />
            </div>
            <h2 className="m-0 text-sm font-semibold text-ink">No Payment History</h2>
            <p className="mt-1 max-w-[260px] text-[13px] leading-[1.5] text-ink-faint">
              Once you make payment, your transaction history will appear here.
            </p>
          </section>
          <div className="mx-3 flex flex-col items-center gap-2 px-6 py-12 text-center md:hidden">
            <div className="mb-1 flex h-20 w-20 items-center justify-center rounded-full bg-[#eef1ff] text-[#5868df]">
              <Gift size={38} strokeWidth={1.7} />
            </div>
            <p className="m-0 text-sm font-semibold text-ink">No Payment History</p>
            <p className="m-0 max-w-[260px] text-[13px] leading-[1.5] text-ink-ghost">
              Once you make payment, your transaction history will appear here.
            </p>
          </div>
        </>
      ) : (
        groups.map(([label, txs]) => (
          <div
            key={label}
            className="bg-surface-container rounded-2xl mx-3 mt-0 mb-3 overflow-hidden md:mx-0"
          >
            <div className="py-3 px-5 flex items-center gap-1.5 border-b border-stacked-container">
              <span className="text-sm font-bold text-[#2563eb]">{label}</span>
            </div>
            {txs.map((tx) => (
              <TxRow key={tx.id} tx={tx} onOpen={(t) => navigate(`/member/transactions/${t.id}`)} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
