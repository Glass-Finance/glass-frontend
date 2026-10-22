import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Clock } from "lucide-react";
import noCommunityIcon from "../../assets/auth/no-community.webp";
import paymentsDueIcon from "../../assets/memberApp/icon-payments-due.webp";
import upcomingPaymentsIcon from "../../assets/memberApp/icon-upcoming-payments.webp";
import paymentHistoryIcon from "../../assets/memberApp/icon-payment-history.webp";
import { Button } from "../../components/ui/Button";
import PulseImg from "../../components/common/PulseImg";
import {
  formatNaira,
  formatDateLong as formatDate,
  formatDate as formatDateShort,
} from "../../utils/format";

export function CommunitySwitcher({
  communities,
  activeIdentifier,
  communityName,
  communityInitial,
  communityLogo,
  onSelect,
  navigate,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[7px] min-w-0 bg-transparent border-none cursor-pointer p-0"
      >
        <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 overflow-hidden bg-brand-deep">
          <PulseImg
            src={communityLogo?.url}
            className="w-full h-full"
            skeletonClassName="bg-black/10"
            fallback={<span>{communityInitial}</span>}
          />
        </div>
        <span className="text-sm font-medium text-ink whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] md:max-w-[300px]">
          {communityName}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`text-ink-muted flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-[280px] bg-surface-container backdrop-blur-md rounded-xl border border-surface-container-border shadow-lg py-1.5">
          {communities.map((c) => {
            const id = c.slug ?? c.id;
            const isActive = id === activeIdentifier;
            return (
              <button
                key={id}
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left bg-transparent border-none cursor-pointer hover:bg-[#F7F8FB]"
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden ${c.logo?.url ? "bg-transparent" : "bg-brand-deep"}`}
                >
                  {c.logo?.url ? (
                    <img
                      src={c.logo.url}
                      alt=""
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (c.name ?? "?").charAt(0).toUpperCase()
                  )}
                </div>
                <span className="flex-1 min-w-0 text-sm text-ink truncate">{c.name}</span>
                {isActive && (
                  <Check size={15} strokeWidth={2.5} className="text-brand flex-shrink-0" />
                )}
              </button>
            );
          })}

          <div className="h-px bg-surface-container-border/50 my-1.5" />

          <Button
            variant="tertiary"
            size="sm"
            onClick={() => {
              setOpen(false);
              navigate("/member/communities");
            }}
          >
            Browse Your Communities
          </Button>
        </div>
      )}
    </div>
  );
}

export function HeroCard({ nextDue, onPay, error, onRefresh }) {
  if (!nextDue) {
    const isError = Boolean(error);
    return (
      <div className="relative mx-4 rounded-lg overflow-hidden bg-white md:mx-0">
        <div className="absolute inset-0 rounded-lg border-[1.5px] border-surface-container-border pointer-events-none" />
        <div
          className={`absolute inset-0 rounded-lg border-[1.5px] pointer-events-none ${isError ? "border-danger" : "border-brand"}`}
          style={{
            maskImage: "linear-gradient(to bottom, black 0%, black 15%, transparent 55%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 15%, transparent 55%)",
          }}
        />
        <div className="pt-10 px-6 pb-5 flex flex-col items-center">
          {isError ? (
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-danger-tint">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="var(--color-danger-bright-2)"
                  strokeWidth="1.8"
                />
                <path
                  d="M12 8v4M12 16h.01"
                  stroke="var(--color-danger-bright-2)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          ) : (
            <img src={paymentsDueIcon} alt="" className="w-14 h-14 object-contain" loading="lazy" />
          )}
        </div>

        <div className="text-center flex flex-col items-center px-6 pt-2 pb-8">
          {isError ? (
            <>
              <p className="text-lg text-ink font-bold mb-1.5">Couldn't load payments</p>
              <p className="text-[13px] text-ink-faint m-0 leading-normal">
                Check your connection and try again.
              </p>
              <Button
                variant="outline-caution"
                size="xs"
                onClick={onRefresh}
                fullWidth={false}
                className="mt-4"
              >
                Try again
              </Button>
            </>
          ) : (
            <>
              <p className="text-lg text-ink font-normal mb-2 tracking-[-0.2px]">No Payments Due</p>
              <p className="text-[13px] text-ink-faint m-0 leading-normal">
                New dues Will Appear Here
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const isRecurring = nextDue.type === "recurring";
  const isOverdue = new Date(nextDue.dueDate) < new Date();

  return (
    <div className="relative mx-4 rounded-lg overflow-hidden bg-white md:mx-0">
      <div className="absolute inset-0 rounded-lg border-[1.5px] border-surface-container-border pointer-events-none" />
      <div
        className={`absolute inset-0 rounded-lg border-[1.5px] pointer-events-none ${isOverdue ? "border-danger" : "border-brand"}`}
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, black 15%, transparent 55%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 15%, transparent 55%)",
        }}
      />
      <div className="pt-5 px-5 flex flex-col items-center">
        <div className="border border-surface-container-border mb-3.5 py-1.5 px-[18px] rounded-full text-ink-strong text-xs font-medium flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isRecurring ? "bg-accent-purple" : "bg-danger"}`}
          />
          {isRecurring ? "Recurring" : "One-time"}
        </div>

        <p className="text-[13px] text-ink-muted mb-1.5 font-normal">Next Payment Due</p>
        <p className="text-[42px] font-bold text-ink tracking-[-1px] leading-none mb-3.5">
          {formatNaira(nextDue.amount)}
        </p>
      </div>

      <div className="px-5 pb-5 flex flex-col items-center">
        <div className="py-1.5 px-4 rounded-lg bg-brand-mist text-brand text-xs font-normal mb-2.5">
          {nextDue.name}
        </div>

        <div
          className={`flex items-center gap-[5px] mb-[18px] text-xs ${isOverdue ? "text-danger font-semibold" : "text-ink-faint font-normal"}`}
        >
          <Clock size={12} strokeWidth={1.8} />
          <span>Due {formatDate(nextDue.dueDate)}</span>
        </div>

        <Button
          onClick={() => onPay(nextDue)}
          fullWidth={false}
          variant={isOverdue ? "critical" : "primary"}
          size="md"
          className="w-full"
        >
          Pay Now
        </Button>
      </div>
    </div>
  );
}

export function UpcomingRow({ payment, onPay }) {
  const isRecurring = payment.type === "recurring";
  const badgeLabel = isRecurring ? "Recurring" : "One-time";
  const badgeCls = isRecurring ? "text-brand-deep bg-[#E8ECF8]" : "text-[#9C27B0] bg-[#F3E5F5]";

  return (
    <div className="py-3.5 px-3 my-4 rounded-lg bg-white flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-0.5 mb-1.5">
          <span className="text-[17px] font-bold text-ink">{formatNaira(payment.amount)}</span>
        </div>
        <p className="text-[13px] text-ink font-normal mb-1">{payment.name}</p>
        <div className="flex items-center gap-1 text-ink-ghost">
          <Clock size={11} strokeWidth={1.8} />
          <span className="text-xs">Due: {formatDateShort(payment.dueDate)}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-4 flex-shrink-0">
        <span className={`text-[11px] font-semibold py-[3px] px-2.5 rounded-full ${badgeCls}`}>
          {badgeLabel}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPay(payment)}>
          Pay Now
        </Button>
      </div>
    </div>
  );
}

export function HistoryRow({ item, onOpen }) {
  const isSuccess = item.status === "success" || item.status === "successful";
  return (
    <div
      onClick={() => onOpen(item)}
      className="flex items-center justify-between py-[13px] border-b border-[#F0F0F0] cursor-pointer"
    >
      <div>
        <p className="text-sm font-medium text-ink mb-[3px]">{item.description}</p>
        <p className="text-xs text-ink-ghost">{formatDateShort(item.date)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-bold text-ink">{formatNaira(item.amount)}</span>
        <span
          className={`text-[11px] font-semibold py-0.5 px-2.5 rounded-full ${isSuccess ? "text-success-strong bg-success-wash" : "text-danger bg-danger-wash"}`}
        >
          {isSuccess ? "Success" : "Failed"}
        </span>
      </div>
    </div>
  );
}

export function NoCommunityState({ navigate }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pt-[60px] pb-20 text-center md:col-span-2 md:mx-auto md:min-h-[400px] md:w-full md:max-w-2xl md:rounded-2xl md:border md:border-surface-container-border md:bg-white md:px-10 md:py-10">
      <img
        src={noCommunityIcon}
        alt=""
        className="w-28 h-28 object-contain mb-7 flex-shrink-0"
        loading="lazy"
      />

      <p className="text-lg font-semibold text-ink mb-2.5 leading-snug">
        You're not part of any community yet.
      </p>
      <p className="text-sm text-ink-ghost mb-9 leading-relaxed">
        Join a community or check your invitations to get started.
      </p>

      <Button onClick={() => navigate("/member/communities/search")} className="mb-4">
        Join A Community
      </Button>

      <Button
        variant="tertiary"
        size="sm"
        fullWidth={false}
        onClick={() => navigate("/member/notifications")}
      >
        Check Your Invites
      </Button>
    </div>
  );
}

export function NothingHappeningState({ navigate }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pt-[60px] pb-20 text-center md:col-span-2 md:mx-auto md:min-h-[400px] md:w-full md:max-w-2xl md:rounded-2xl md:border md:border-surface-container-border md:bg-white md:px-10 md:py-10">
      <img
        src={noCommunityIcon}
        alt=""
        className="w-28 h-28 object-contain mb-7 flex-shrink-0"
        loading="lazy"
      />

      <p className="text-lg font-semibold text-ink mb-2.5 leading-snug">
        Nothing happening here yet.
      </p>
      <p className="text-sm text-ink-ghost mb-9 leading-relaxed">
        Check out your other communities to see what's happening.
      </p>

      <Button onClick={() => navigate("/member/communities/search")} className="mb-4">
        Browse Communities
      </Button>

      <Button
        variant="tertiary"
        size="sm"
        fullWidth={false}
        onClick={() => navigate("/member/notifications")}
      >
        Check Your Invites
      </Button>
    </div>
  );
}

export function PendingApprovalState({ navigate, community }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 pt-[60px] pb-20 text-center md:col-span-2 md:mx-auto md:min-h-[400px] md:w-full md:max-w-2xl md:rounded-2xl md:border md:border-surface-container-border md:bg-white md:px-10 md:py-10">
      <div className="w-20 h-20 rounded-full bg-[#FFF7E0] flex items-center justify-center mb-7">
        <Clock size={36} strokeWidth={1.6} className="text-accent-gold" />
      </div>
      <p className="text-xl font-bold text-ink mb-2.5">Request Pending</p>
      <p className="text-sm text-ink-ghost mb-2 leading-relaxed max-w-[260px]">
        Your request to join {community?.name ?? "this community"} is awaiting admin approval.
      </p>
      <p className="text-[13px] text-ink-ghost mb-9">You'll get access once it's approved.</p>
      <Button
        variant="outline"
        size="md"
        fullWidth={false}
        onClick={() => navigate("/member/communities/search")}
      >
        Browse Other Communities
      </Button>
    </div>
  );
}

export function EmptyUpcomingState() {
  return (
    <div className="flex flex-col items-center px-4 pt-7 pb-5 text-center gap-0">
      <img
        src={upcomingPaymentsIcon}
        alt=""
        className="w-[52px] h-[52px] object-contain mb-3.5"
        loading="lazy"
      />
      <p className="text-sm font-medium text-ink mb-1.5">No Upcoming Payments</p>
      <p className="text-sm font-normal text-ink m-0 leading-[1.55] max-w-[270px]">
        New Dues from community will show up here once scheduled
      </p>
    </div>
  );
}

export function EmptyHistoryState() {
  return (
    <div className="flex flex-col items-center px-4 pt-7 pb-5 text-center gap-0">
      <img
        src={paymentHistoryIcon}
        alt=""
        className="w-[52px] h-[52px] object-contain mb-3.5"
        loading="lazy"
      />
      <p className="text-sm font-medium text-ink mb-1.5">No Payment History</p>
      <p className="text-sm font-normal text-ink m-0 leading-[1.55] max-w-[230px]">
        Once you make payment, your transaction history will appear here.
      </p>
    </div>
  );
}

export function ProfileNudge({ navigate, user }) {
  if (!user || user.phoneVerified) return null;

  return (
    <button
      onClick={() => navigate("/member/verify-phone")}
      className="w-[calc(100%-40px)] mx-5 mb-4 flex items-center gap-3 text-left bg-brand-mist rounded-2xl px-4 py-3.5 border-none cursor-pointer md:col-span-2 md:mx-0 md:mb-0 md:w-full"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-brand m-0">Add Your Phone Number</p>
        <p className="text-[13px] text-brand/80 mt-0.5 mb-0 leading-snug">
          We will use it for payment reminders and account security.
        </p>
      </div>
      <ChevronRight size={18} className="text-brand flex-shrink-0" />
    </button>
  );
}
