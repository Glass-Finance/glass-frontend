import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { usePayments } from "../../hooks/usePayments";
import PageLoadingState from "../../components/common/PageLoadingState";
import GlassLogoGlow from "../../components/memberApp/GlassLogoGlow";
import { formatNaira, formatDate, toTitleCase } from "../../utils/format";
import { useExportJob } from "../../hooks/useExportJob";
import { exportMyObligations } from "../../api/exports";
import { MobileBackButton } from "../../components/ui/MobileBackButton";

const FILTER_OPTIONS = ["All", "Recurring", "One-time"];

function FilterDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" fullWidth={false} onClick={() => setOpen((o) => !o)}>
        {value}
        <ChevronDown size={14} strokeWidth={2} className="text-ink-muted" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 bg-white rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-outline-on-surface z-20 overflow-hidden min-w-[130px] [top:calc(100%+6px)]">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`block w-full text-left py-[11px] px-4 text-[13px] cursor-pointer border-none ${value === opt ? "bg-[#F0F2FA] text-brand font-semibold" : "bg-white text-ink font-normal"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PaymentRow({ item, onPay, paying }) {
  const isRecurring = item.type === "recurring";
  const badge = isRecurring
    ? { label: "Recurring", cls: "text-accent-purple", dotCls: "bg-accent-purple" }
    : { label: "One-time", cls: "text-danger", dotCls: "bg-danger" };

  return (
    <div className="border border-surface-container-border py-[18px] px-4 bg-white rounded-2xl flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5 mb-1.5">
          <span className="text-xl font-bold text-ink">{formatNaira(item.amount)}</span>
          {isRecurring && <span className="text-[13px] text-ink-ghost">/month</span>}
          <span
            className={`inline-flex items-center gap-[5px] text-xs font-semibold ml-1 ${badge.cls}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${badge.dotCls}`} />
            {badge.label}
          </span>
        </div>
        <p className="text-[15px] text-ink mt-0 mx-0 mb-[3px] font-medium">
          {toTitleCase(item.name)}
        </p>
        <p className="text-[13px] text-ink-faint m-0">Due: {formatDate(item.dueDate)}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        fullWidth={false}
        className="flex-shrink-0"
        onClick={() => onPay(item)}
        disabled={paying}
      >
        {paying ? "Starting…" : "Pay Now"}
      </Button>
    </div>
  );
}

export default function UpcomingPayments() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const { data, isLoading, error: loadError, refresh } = usePayments();

  // Real backend export job (see useExportJob.js) instead of a client-side CSV,
  // which would only cover the payments already loaded on this page. The
  // Recurring/One-time picker is a client-side filter and ObligationQueryDto
  // has no equivalent server-side field, so the export covers every obligation
  // the backend holds for this member.
  const { run: runExport, isExporting } = useExportJob();
  function exportCsv() {
    runExport(() => exportMyObligations({}));
  }

  const upcoming = data?.upcoming ?? [];
  const filtered = upcoming.filter((item) => {
    if (filter === "All") return true;
    if (filter === "Recurring") return item.type === "recurring";
    return item.type === "one-time";
  });

  function handlePay(item) {
    const suffix = item._isLink ? "?via=link" : "";
    // See Home.jsx's handlePay -- PaymentSummary's own fetch may not carry
    // community info back, so pass along what we already have as a fallback.
    navigate(`/member/pay/${item.id}${suffix}`, {
      state: { communityName: item.communityName, communityLogo: item.logo },
    });
  }

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />
      {/* Header */}
      <div className="relative flex items-center justify-center pt-6 px-5 pb-5">
        <MobileBackButton
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="absolute left-5"
        />
        <h1 className="text-lg font-medium text-ink m-0">Upcoming Payments</h1>
        <Button
          variant="tertiary"
          size="icon-sm"
          onClick={exportCsv}
          disabled={isExporting}
          aria-label={isExporting ? "Preparing export" : "Export upcoming payments as CSV"}
          className="absolute right-5"
        >
          {isExporting ? (
            <Loader2 size={15} className="animate-spin text-ink-strong" />
          ) : (
            <Download size={15} className="text-ink-strong" />
          )}
        </Button>
      </div>

      {/* Filter */}
      <div className="pt-0 px-4 pb-4">
        <FilterDropdown value={filter} onChange={setFilter} />
      </div>

      {/* List */}
      <div className="mx-4 flex flex-col gap-3">
        {isLoading ? (
          <div className="border border-surface-container-border bg-white rounded-2xl">
            <PageLoadingState size={56} padding="36px 24px" />
          </div>
        ) : loadError ? (
          <div className="border border-surface-container-border bg-white rounded-2xl text-center py-5">
            <p className="text-danger text-sm mt-0 mx-0 mb-2">Couldn't load upcoming payments.</p>
            <Button variant="tertiary" size="sm" fullWidth={false} onClick={refresh}>
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-surface-container-border bg-white rounded-2xl py-12 px-6 text-center flex flex-col items-center gap-2">
            <div className="w-[52px] h-[52px] rounded-full bg-brand-mist flex items-center justify-center mb-1">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-brand)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5 9-9" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-ink-strong m-0">Nothing due right now</p>
            <p className="text-[13px] text-ink-faint m-0">You're up to date on all payments.</p>
            <Button variant="tertiary" size="sm" fullWidth={false} onClick={refresh}>
              Check again
            </Button>
          </div>
        ) : (
          filtered.map((item) => <PaymentRow key={item.id} item={item} onPay={handlePay} />)
        )}
      </div>
    </div>
  );
}
