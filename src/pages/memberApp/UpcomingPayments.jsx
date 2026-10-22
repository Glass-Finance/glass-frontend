import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useNavigate } from "react-router-dom";
import { Bell, Check, ChevronDown, Download, Loader2, RefreshCw } from "lucide-react";
import { usePayments } from "../../hooks/usePayments";
import PageLoadingState from "../../components/common/PageLoadingState";
import GlassLogoGlow from "../../components/memberApp/GlassLogoGlow";
import { formatNaira, formatDate, toTitleCase } from "../../utils/format";
import { useExportJob } from "../../hooks/useExportJob";
import { exportMyObligations } from "../../api/exports";
import MemberPageHeader from "../../components/memberApp/MemberPageHeader";
import glassMark from "../../assets/Glass.webp";

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
    <div className="relative mx-auto min-h-screen max-w-[430px] overflow-hidden pb-10 md:max-w-none">
      <GlassLogoGlow />
      {/* Header */}
      <MemberPageHeader
        title="Upcoming Payments"
        description="Review upcoming dues and export your payment schedule."
        onBack={() => navigate(-1)}
        action={
          <Button
            variant="tertiary"
            size="icon-sm"
            onClick={exportCsv}
            disabled={isExporting}
            aria-label={isExporting ? "Preparing export" : "Export upcoming payments as CSV"}
          >
            {isExporting ? (
              <Loader2 size={15} className="animate-spin text-ink-strong" />
            ) : (
              <Download size={15} className="text-ink-strong" />
            )}
          </Button>
        }
      />

      <div className="md:w-full">
        {/* Filter */}
        <div className="pt-0 px-4 pb-4 md:px-0">
          <FilterDropdown value={filter} onChange={setFilter} />
        </div>

        {/* List */}
        <div className="mx-4 flex flex-col gap-3 md:mx-0">
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
            <>
              <section className="hidden overflow-hidden rounded-g-2 border border-surface-container-border bg-white md:block">
                <div className="flex min-h-[382px] flex-col items-center px-8 pb-10 pt-14 text-center">
                  <div className="relative mb-7 h-[92px] w-[100px]">
                    <img src={glassMark} alt="" className="h-full w-full object-contain" />
                    <span className="absolute -bottom-2 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-success text-white">
                      <Check size={19} strokeWidth={2.5} />
                    </span>
                  </div>
                  <h2 className="m-0 text-2xl font-semibold text-ink">You're all caught up</h2>
                  <p className="mt-2 max-w-[460px] text-base leading-6 text-ink-muted">
                    Nothing is due right now. When a community adds a payment, it will show up here
                    with its due date.
                  </p>
                  <div className="mt-7 flex items-center gap-3">
                    <Button variant="outline" size="md" fullWidth={false} onClick={refresh}>
                      <RefreshCw size={16} />
                      Check again
                    </Button>
                    <Button
                      variant="outline-neutral"
                      size="md"
                      fullWidth={false}
                      onClick={() => navigate("/member/transactions")}
                    >
                      View payment history
                    </Button>
                  </div>
                </div>
                <div className="flex min-h-[50px] items-center justify-between gap-4 border-t border-surface-container-border bg-surface-sunken/50 px-7 text-sm text-ink-muted">
                  <span>Last checked just now</span>
                  <span className="flex items-center gap-1.5">
                    <Bell size={14} />
                    Want a heads-up when something is due?{" "}
                    <button
                      type="button"
                      onClick={() => navigate("/member/notification-settings")}
                      className="border-0 bg-transparent p-0 font-semibold text-brand underline underline-offset-2"
                    >
                      Turn on notifications
                    </button>
                  </span>
                </div>
              </section>
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-surface-container-border bg-white px-6 py-12 text-center md:hidden">
                <div className="mb-1 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-brand-mist">
                  <Check size={22} className="text-brand" />
                </div>
                <p className="m-0 text-sm font-semibold text-ink-strong">Nothing due right now</p>
                <p className="m-0 text-[13px] text-ink-faint">You're up to date on all payments.</p>
                <Button variant="tertiary" size="sm" fullWidth={false} onClick={refresh}>
                  Check again
                </Button>
              </div>
            </>
          ) : (
            filtered.map((item) => <PaymentRow key={item.id} item={item} onPay={handlePay} />)
          )}
        </div>
      </div>
    </div>
  );
}
