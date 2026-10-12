import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import GlassLogoGlow from "../../components/memberApp/GlassLogoGlow";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { usePayments, useManagePayments } from "../../hooks/usePayments";
import PageLoadingState from "../../components/common/PageLoadingState";
import EmptyState from "../../components/common/EmptyState";
import managePaymentsEmptyIllustration from "../../assets/memberApp/empty-states/manage-payments-empty.webp";
import Toggle from "../../components/common/Toggle";
import ConfirmSheet from "../../components/memberApp/ConfirmSheet";
import { formatNaira, formatDate, toTitleCase } from "../../utils/format";
import { normalizeImageObject } from "../../utils/normalizeImageFields";
import { MobileBackButton } from "../../components/ui/MobileBackButton";

function frequencyLabel(freq) {
  const f = (freq ?? "").toUpperCase();
  if (f === "MONTHLY") return "/month";
  if (f === "WEEKLY") return "/week";
  if (f === "QUARTERLY") return "/quarter";
  if (f.includes("YEAR") || f === "ANNUALLY") return "/year";
  if (f === "DAILY") return "/day";
  return "";
}

// ── Mastercard-style overlapping circles icon ─────────────────────────────────
function CardIcon({ cardType }) {
  const type = (cardType ?? "").toUpperCase();
  // Mastercard: red + orange circles; Visa: blue circle; default: grey
  const leftCls = type.includes("MASTER")
    ? "bg-[#EB001B]"
    : type.includes("VISA")
      ? "bg-[#1A1F71]"
      : "bg-ink-ghost";
  const rightCls = type.includes("MASTER")
    ? "bg-[#F79E1B]"
    : type.includes("VISA")
      ? "bg-[#00B1EA]"
      : "bg-[#bbb]";
  return (
    <div className="relative w-[30px] h-5 flex-shrink-0">
      <div className={`absolute left-0 w-5 h-5 rounded-full opacity-90 ${leftCls}`} />
      <div className={`absolute left-2.5 w-5 h-5 rounded-full opacity-85 ${rightCls}`} />
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

// ── Filter dropdown ───────────────────────────────────────────────────────────
const FILTER_OPTIONS = ["All", "Auto-Pay On", "Auto-Pay Off"];

function FilterDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <Button variant="outline" size="sm" fullWidth={false} onClick={() => setOpen((o) => !o)}>
        {value} <ChevronDown size={14} strokeWidth={2} className="text-ink-muted" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 bg-white rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] z-20 min-w-[150px] overflow-hidden [top:calc(100%+6px)]">
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

// ── Plan card (matches Figma) ─────────────────────────────────────────────────
function PlanCard({ plan, auth, onToggle }) {
  const isOn = !!auth;
  const cardLabel = auth?.last4 ? `***${auth.last4}` : null;
  const expiry =
    auth?.expMonth && auth?.expYear
      ? `${String(auth.expMonth).padStart(2, "0")}/${String(auth.expYear).slice(-2)}`
      : null;

  return (
    <div className="border border-surface-container-border bg-white rounded-2xl overflow-hidden">
      {/* Main body */}
      <div className="pt-4 px-4 pb-3.5">
        {/* Row 1: logo + Recurring badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="w-11 h-11 rounded-[10px] bg-brand-glow flex items-center justify-center overflow-hidden flex-shrink-0">
            {plan.logo?.url ? (
              <img
                src={plan.logo.url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-lg font-bold text-brand-deep">{plan.logoText ?? "P"}</span>
            )}
          </div>
          <span className="text-xs font-semibold text-brand bg-[#E8EEFF] py-1 px-3 rounded-full">
            Recurring
          </span>
        </div>

        {/* Row 2: amount */}
        <p className="text-xl font-bold text-ink mt-0 mx-0 mb-1">
          {formatNaira(plan.amount)}
          <span className="text-[13px] font-normal text-ink-ghost">
            {frequencyLabel(plan.frequency)}
          </span>
        </p>

        {/* Row 3: plan name + auto-pay toggle */}
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-medium text-ink m-0">{toTitleCase(plan.name)}</p>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-ink-ghost">Auto-Pay</span>
            <Toggle on={isOn} onChange={() => onToggle(plan, auth)} />
          </div>
        </div>

        {/* Row 4: next charge */}
        {plan.dueDate && (
          <p className="text-[13px] text-ink-ghost mt-1.5 mx-0 mb-0">
            Next charge: {formatDate(plan.dueDate)}
          </p>
        )}
      </div>

      {/* Card row */}
      <div className="border-t border-hairline-soft py-3 px-4 flex items-center justify-between">
        {cardLabel ? (
          <>
            <div className="flex items-center gap-2.5">
              <CardIcon cardType={auth?.cardType ?? auth?.channel} />
              <span className="text-sm font-medium text-ink">
                {cardLabel}
                {expiry ? ` | ${expiry}` : ""}
              </span>
            </div>
            <Button variant="tertiary" size="sm" fullWidth={false}>
              Change
            </Button>
          </>
        ) : (
          <span className="text-[13px] text-ink-ghost">No saved card</span>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ManagePayments() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const { data, isLoading: paymentsLoading } = usePayments();
  const {
    data: authorisations,
    isLoading: authsLoading,
    toggleAutoPay,
    isRemoving,
  } = useManagePayments();
  const [turningOff, setTurningOff] = useState(null); // { plan, auth }

  const isLoading = paymentsLoading || authsLoading;

  // Build unique recurring plans from upcoming obligations
  const recurringPlans = useMemo(() => {
    const seen = new Map();
    for (const o of data?.upcoming ?? []) {
      if (o.type !== "recurring") continue;
      const key = o.paymentLinkId ?? `${o.name}__${o.communityName}`;
      // SECURITY: `o.logo` reaches <img src> below. The obligation shapers
      // already normalize it, but this list also merges locally-built plan
      // objects, so normalize on the way in rather than relying on every
      // producer of `data.upcoming` having done so. Falls back to the original
      // object when there is nothing to change, keeping referential stability.
      if (!seen.has(key)) {
        seen.set(key, o?.logo ? { ...o, logo: normalizeImageObject(o.logo) } : o);
      }
    }
    // Also surface plans from auth consents that may not have an obligation yet
    for (const auth of authorisations ?? []) {
      for (const c of auth.consents ?? []) {
        if (c.revoked) continue;
        const key = c.paymentLinkId ?? `${c.paymentLinkTitle}__${c.communityName}`;
        if (!seen.has(key)) {
          seen.set(key, {
            paymentLinkId: c.paymentLinkId,
            name: c.paymentLinkTitle ?? "Payment Plan",
            communityName: c.communityName ?? "",
            amount: null,
            frequency: null,
            dueDate: null,
            logoText: (c.communityName ?? "P").charAt(0).toUpperCase(),
            logo: null,
          });
        }
      }
    }
    return [...seen.values()];
  }, [data, authorisations]);

  function findAuth(plan) {
    for (const auth of authorisations ?? []) {
      const match = auth.consents.find((c) => {
        if (c.revoked) return false;
        if (plan.paymentLinkId && c.paymentLinkId) return c.paymentLinkId === plan.paymentLinkId;
        return c.paymentLinkTitle === plan.name && c.communityName === plan.communityName;
      });
      if (match) return auth;
    }
    return null;
  }

  function handleToggle(plan, auth) {
    if (auth) {
      setTurningOff({ plan, auth });
    }
    // Turning ON requires initiating a payment with a new card — navigate to payment flow
    // (enabling is done automatically when a payment is completed with a reusable card)
  }

  const filtered = recurringPlans.filter((plan) => {
    const auth = findAuth(plan);
    if (filter === "Auto-Pay On") return !!auth;
    if (filter === "Auto-Pay Off") return !auth;
    return true;
  });

  return (
    <div className="relative overflow-hidden pb-[60px] min-h-screen">
      <GlassLogoGlow />
      {/* Header */}
      <div className="relative flex items-center justify-center pt-[22px] px-5 pb-5">
        <MobileBackButton
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="absolute left-5"
        />
        <h1 className="text-lg font-medium text-ink m-0">Manage Payments</h1>
      </div>

      <div className="px-4">
        {/* Filter — hidden while empty per design (there is nothing to filter) */}
        {(isLoading || recurringPlans.length > 0) && (
          <div className="mb-4">
            <FilterDropdown value={filter} onChange={setFilter} />
          </div>
        )}

        {/* Cards */}
        <div className="flex flex-col gap-3.5">
          {isLoading ? (
            <PageLoadingState size={56} padding="36px 24px" />
          ) : recurringPlans.length === 0 ? (
            // Same vertical placement as the Notifications empty state:
            // both centre their block in 55vh, but that page's content
            // starts 54px lower (its tab strip), so it needs +2x that here.
            <EmptyState
              illustration={managePaymentsEmptyIllustration}
              illustrationClassName="w-20 h-20 object-contain mb-2.5"
              title="No Payment Plans Yet"
              titleClassName="text-sm font-semibold text-ink"
              subtitle="Your active payment plans can be managed here."
              subtitleClassName="text-xs text-ink-ghost mt-2.5 max-w-[240px] leading-relaxed"
              className="min-h-[calc(55vh+122px)] justify-center"
            />
          ) : filtered.length === 0 ? (
            <p className="text-center text-ink-ghost text-sm mt-10">No plans match this filter.</p>
          ) : (
            filtered.map((plan) => (
              <PlanCard
                key={plan.paymentLinkId ?? `${plan.name}-${plan.communityName}`}
                plan={plan}
                auth={findAuth(plan)}
                onToggle={handleToggle}
              />
            ))
          )}
        </div>
      </div>

      {turningOff && (
        <ConfirmSheet
          title="Turn Off Auto-Pay?"
          description={`This removes the saved payment method for ${turningOff.plan.name} entirely — Auto-Pay will stop for every plan tied to that same method, not just this one.`}
          confirmLabel="Yes, turn off"
          confirmingLabel="Turning off…"
          confirming={isRemoving}
          onCancel={() => setTurningOff(null)}
          onConfirm={() =>
            toggleAutoPay(turningOff.auth.id, false, { onSuccess: () => setTurningOff(null) })
          }
        />
      )}
    </div>
  );
}
